/**
 * A multi-fixture file (SPEC §3.1): the default export is an **object**, and
 * its keys are the fixture names. Named exports are never fixtures, which is
 * exactly what leaves room for the two metadata exports below.
 *
 * §3.1 was explicit about a distinction v0.6 blurred: `fileMeta` is
 * file-level and `fixtureMeta` is keyed by fixture name. Viewport can live in
 * either, and the per-fixture one wins.
 *
 * The empty-string key is deliberate. §3.2 requires `name: ''` and
 * `name: null` to be different states that both round-trip through the
 * canonical id encoding, and a fixture file is the only place that can be
 * proven from.
 */

import { Badge, Card, DataTable, Separator, Typography } from "ljkui";
import type * as React from "react";
import type { FixtureFileMeta, FixtureMeta } from "@aussieljk/uight";
import { Money, Sku } from "../domain/money";

export const fileMeta: FixtureFileMeta = {
	group: "Demo",
	tags: ["hand-written"],
	// Default viewport for every fixture in this file.
	viewport: { width: 720, height: 520 },
	order: 10,
};

export const fixtureMeta: Record<string, FixtureMeta> = {
	Plans: {
		title: "Pricing plans",
		description: "Three tiers, rendered from Money instances.",
	},
	Receipt: {
		title: "Receipt",
		// Overrides fileMeta.viewport for this fixture only.
		viewport: { width: 375, height: 667 },
		tags: ["mobile"],
	},
	"": {
		title: "(empty name)",
		description:
			"An object key that is the empty string. Legal JavaScript, so the id encoding has to survive it.",
	},
};

const PLANS = [
	{ name: "Starter", price: Money.fromMajor("USD", 0), sku: new Sku("plan-starter") },
	{ name: "Pro", price: Money.fromMajor("USD", 29), sku: new Sku("plan-pro") },
	{ name: "Team", price: Money.fromMajor("USD", 99), sku: new Sku("plan-team") },
];

const row: React.CSSProperties = {
	display: "flex",
	gap: "var(--space-3)",
	alignItems: "stretch",
};

export default {
	Plans: (
		<div style={row}>
			{PLANS.map((plan) => (
				<Card key={plan.name} size="2" style={{ width: 180 }}>
					<Typography.Heading size="3">{plan.name}</Typography.Heading>
					<Typography.Text size="6" weight="bold">
						{plan.price.format()}
					</Typography.Text>
					<Typography.Text size="1" color="gray">
						{plan.sku.format()}
					</Typography.Text>
				</Card>
			))}
		</div>
	),

	Receipt: (
		<Card size="2" style={{ maxWidth: 320 }}>
			<Typography.Heading size="3">Receipt</Typography.Heading>
			<Separator size="4" style={{ marginTop: 8, marginBottom: 8 }} />
			<DataTable.Root>
				<DataTable.Item>
					<DataTable.Label>Plan</DataTable.Label>
					<DataTable.Value>Pro</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Amount</DataTable.Label>
					<DataTable.Value>{Money.fromMajor("USD", 29).format()}</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Tax</DataTable.Label>
					<DataTable.Value>{Money.fromMajor("USD", 2.9).format()}</DataTable.Value>
				</DataTable.Item>
				<DataTable.Item>
					<DataTable.Label>Status</DataTable.Label>
					<DataTable.Value>
						<Badge color="green">Paid</Badge>
					</DataTable.Value>
				</DataTable.Item>
			</DataTable.Root>
		</Card>
	),

	// §3.2: `name: ''` encodes to an empty third segment; `name: null` produces
	// no third segment at all. Different states, distinguishable on the wire.
	"": (
		<Card size="2">
			<Typography.Text size="2">
				This fixture's name is the empty string, not the absence of a name.
			</Typography.Text>
		</Card>
	),
};
