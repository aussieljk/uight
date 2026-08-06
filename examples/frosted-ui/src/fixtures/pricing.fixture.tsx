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

import { Badge, Card, DataList, Heading, Separator, Text } from "frosted-ui";
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
					<Heading size="3">{plan.name}</Heading>
					<Text size="6" weight="bold">
						{plan.price.format()}
					</Text>
					<Text size="1" color="gray">
						{plan.sku.format()}
					</Text>
				</Card>
			))}
		</div>
	),

	Receipt: (
		<Card size="2" style={{ maxWidth: 320 }}>
			<Heading size="3">Receipt</Heading>
			<Separator size="4" style={{ marginTop: 8, marginBottom: 8 }} />
			<DataList.Root>
				<DataList.Item>
					<DataList.Label>Plan</DataList.Label>
					<DataList.Value>Pro</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Amount</DataList.Label>
					<DataList.Value>{Money.fromMajor("USD", 29).format()}</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Tax</DataList.Label>
					<DataList.Value>{Money.fromMajor("USD", 2.9).format()}</DataList.Value>
				</DataList.Item>
				<DataList.Item>
					<DataList.Label>Status</DataList.Label>
					<DataList.Value>
						<Badge color="green">Paid</Badge>
					</DataList.Value>
				</DataList.Item>
			</DataList.Root>
		</Card>
	),

	// §3.2: `name: ''` encodes to an empty third segment; `name: null` produces
	// no third segment at all. Different states, distinguishable on the wire.
	"": (
		<Card size="2">
			<Text size="2">
				This fixture's name is the empty string, not the absence of a name.
			</Text>
		</Card>
	),
};
