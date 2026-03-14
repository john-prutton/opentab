import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

import { and, eq, sql } from "drizzle-orm"

import { Database } from "@repo/domain/services/database"

import { DrizzleDb, DrizzleDbLive } from "./drizzle.js"
import { MigrateDatabaseLayer } from "./migrator.js"
import { PgPoolClientLive } from "./pool.js"
import {
	oauthAccountsTable,
	receiptLineItemsTable,
	receiptSelectionsTable,
	sessionsTable,
	sharedReceiptsTable,
	usersTable,
} from "./schema/index.js"
import { TryQuery } from "./util.js"

export { PgPoolClient, PgPoolClientLive } from "./pool.js"

export const DatabaseLive = Layer.effect(
	Database,
	Effect.gen(function* () {
		const db = yield* DrizzleDb

		return {
			healthCheck: () => TryQuery(db.execute("select 1").then(() => true)),

			user: {
				createUser: ({ name, email, avatarUrl }) =>
					TryQuery(
						db
							.insert(usersTable)
							.values({ name, email, avatarUrl })
							.returning()
							.then(([user]) => user!.id),
					),
				getUserByEmail: (email) =>
					TryQuery(
						db
							.select()
							.from(usersTable)
							.where(eq(usersTable.email, email))
							.then((results) => results.at(0) ?? null),
					),
			},
			auth: {
				createSession: (session) =>
					TryQuery(db.insert(sessionsTable).values(session)),

				recordUserOAuthProvider: (userId, oauthProviderUserId, oauthProvider) =>
					TryQuery(
						db
							.insert(oauthAccountsTable)
							.values({
								providerId: oauthProvider,
								providerUserId: oauthProviderUserId,
								userId,
							})
							.onConflictDoNothing(),
					),

				getUserSessionByToken: (token) =>
					TryQuery(
						db
							.select({ user: usersTable, session: sessionsTable })
							.from(sessionsTable)
							.innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
							.where(eq(sessionsTable.id, token))
							.then(([res]) => res ?? null),
					),

				refreshSession: (sessionId, expiration) =>
					TryQuery(
						db
							.update(sessionsTable)
							.set({ expirationDate: expiration })
							.where(eq(sessionsTable.id, sessionId))
							.returning()
							.then(([session]) => session!),
					),

				deleteSession: (sessionId) =>
					TryQuery(
						db.delete(sessionsTable).where(eq(sessionsTable.id, sessionId)),
					),

				deleteSessionsForUser: (userId) =>
					TryQuery(
						db.delete(sessionsTable).where(eq(sessionsTable.userId, userId)),
					),
			},
			receipt: {
				createSharedReceipt: (ownerId, imageDataUrl, items) =>
					TryQuery(
						db.transaction(async (tx) => {
							const [receipt] = await tx
								.insert(sharedReceiptsTable)
								.values({ ownerId, imageDataUrl })
								.returning()
							await tx.insert(receiptLineItemsTable).values(
								items.map((item) => ({
									receiptId: receipt!.id,
									description: item.description,
									quantity:
										item.quantity !== null ? String(item.quantity) : null,
									unitPrice:
										item.unitPrice !== null ? String(item.unitPrice) : null,
									totalPrice: String(item.totalPrice),
								})),
							)
							return receipt!.id
						}),
					),

				getSharedReceipt: (id) =>
					TryQuery(
						db
							.select({
								receipt: sharedReceiptsTable,
								lineItem: receiptLineItemsTable,
								selection: receiptSelectionsTable,
								user: usersTable,
							})
							.from(sharedReceiptsTable)
							.leftJoin(
								receiptLineItemsTable,
								eq(receiptLineItemsTable.receiptId, sharedReceiptsTable.id),
							)
							.leftJoin(
								receiptSelectionsTable,
								and(
									eq(receiptSelectionsTable.receiptId, sharedReceiptsTable.id),
									eq(
										receiptSelectionsTable.lineItemId,
										receiptLineItemsTable.id,
									),
								),
							)
							.leftJoin(
								usersTable,
								eq(usersTable.id, receiptSelectionsTable.userId),
							)
							.where(eq(sharedReceiptsTable.id, id))
							.then((rows) => {
								if (rows.length === 0) return null

								const receipt = rows[0]!.receipt

								const lineItemsMap = new Map<
									string,
									{
										id: string
										description: string
										quantity: number | null
										unitPrice: number | null
										totalPrice: number
									}
								>()
								const participantsMap = new Map<
									string,
									{
										userId: string
										userName: string
										selections: Record<string, number>
									}
								>()

								for (const row of rows) {
									if (row.lineItem && !lineItemsMap.has(row.lineItem.id)) {
										lineItemsMap.set(row.lineItem.id, {
											id: row.lineItem.id,
											description: row.lineItem.description,
											quantity:
												row.lineItem.quantity !== null
													? Number(row.lineItem.quantity)
													: null,
											unitPrice:
												row.lineItem.unitPrice !== null
													? Number(row.lineItem.unitPrice)
													: null,
											totalPrice: Number(row.lineItem.totalPrice),
										})
									}

									if (row.selection && row.user) {
										if (!participantsMap.has(row.user.id)) {
											participantsMap.set(row.user.id, {
												userId: row.user.id,
												userName: row.user.name,
												selections: {},
											})
										}
										participantsMap.get(row.user.id)!.selections[
											row.selection.lineItemId
										] = row.selection.quantity
									}
								}

								return {
									id: receipt.id,
									imageDataUrl: receipt.imageDataUrl ?? null,
									lineItems: Array.from(lineItemsMap.values()),
									participants: Array.from(participantsMap.values()),
									createdAt: receipt.createdAt,
								}
							}),
					),

				upsertSelections: (receiptId, userId, selections) =>
					TryQuery(
						selections.length === 0
							? Promise.resolve()
							: db
									.insert(receiptSelectionsTable)
									.values(
										selections.map((s) => ({
											receiptId,
											userId,
											lineItemId: s.lineItemId,
											quantity: s.quantity,
										})),
									)
									.onConflictDoUpdate({
										target: [
											receiptSelectionsTable.receiptId,
											receiptSelectionsTable.userId,
											receiptSelectionsTable.lineItemId,
										],
										set: { quantity: sql`excluded.quantity` },
									})
									.then(() => undefined),
					),
			},
		}
	}),
).pipe(
	Layer.provide(DrizzleDbLive),
	Layer.provide(PgPoolClientLive),
	Layer.provide(MigrateDatabaseLayer),
)
