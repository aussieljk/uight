/**
 * The codec path (SPEC §7.7). `Money` and `Sku` are class instances, so
 * without `src/uight.codecs.tsx` registered they would cross the realm
 * boundary as `opaque` (§7.3) and the control panel would show two uneditable
 * chips. With the codecs registered, `price` gets the custom editor and `sku`
 * gets a label and no editor, because its codec omits one.
 *
 * The nested default is also the point: §7.4's wire format walks objects and
 * arrays, and a codec matches at any depth — `line.price` below is inside an
 * array inside an object.
 */

import { Badge, Card, DataList, Heading, Text } from "frosted-ui";
import { useFixtureInput } from "@aussieljk/uight";
import { Money, Sku } from "../domain/money";

interface Line {
	label: string;
	sku: Sku;
	price: Money;
}

export default function Invoice() {
	const [price] = useFixtureInput("price", Money.fromMajor("USD", 29), {
		label: "Headline price",
		description: "A class instance. Editable only because a codec matched it.",
	});

	const [sku] = useFixtureInput("sku", new Sku("plan-pro"), {
		label: "SKU",
		description: "Display-only: its codec declares no editor.",
	});

	const [lines] = useFixtureInput<Line[]>(
		"lines",
		[
			{ label: "Pro seat", sku: new Sku("seat-pro"), price: Money.fromMajor("USD", 29) },
			{
				label: "Extra storage",
				sku: new Sku("addon-storage"),
				price: Money.fromMajor("EUR", 5),
			},
		],
		{ label: "Line items" },
	);

	const total = lines.reduce((sum, line) => sum + line.price.minorUnits, 0);

	return (
		<Card size="2" style={{ maxWidth: 420 }}>
			<Heading size="3">Value codecs</Heading>
			<Text size="2" color="gray" style={{ display: "block", marginBottom: 12 }}>
				{price.format()} · {sku.format()}
			</Text>

			<DataList.Root>
				{lines.map((line) => (
					<DataList.Item key={line.sku.value}>
						<DataList.Label>{line.label}</DataList.Label>
						<DataList.Value>
							{line.price.format()} <Badge color="gray">{line.sku.format()}</Badge>
						</DataList.Value>
					</DataList.Item>
				))}
				<DataList.Item>
					<DataList.Label>Total (minor units, mixed currency)</DataList.Label>
					<DataList.Value>{total}</DataList.Value>
				</DataList.Item>
			</DataList.Root>
		</Card>
	);
}
