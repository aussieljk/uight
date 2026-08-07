/**
 * Adapted from frosted-ui — Whop's design system — and used here under the MIT
 * licence. Copyright (c) 2023 WorkOS. Copyright (c) 2023 Whop.
 * Full licence text: src/stories/LICENSE-frosted-ui.md
 *
 * Changes from upstream: imports of frosted-ui internals rewritten to the
 * published `frosted-ui` package, and `@storybook/react` types replaced with
 * the local shim in src/stories/csf-types.ts. Any further change to a story
 * body is marked with a comment in place.
 * uight is not affiliated with Whop or frosted-ui.
 */
import type { Meta, StoryObj } from "../../csf-types";

import { Icons } from "ljkui/icons";
import React, { useRef, useState } from "react";
import { Avatar, Badge, Button, Card, Carousel, IconButton, Typography } from "ljkui";

const people = [
	{ name: "Olivia Chen", role: "Design Lead", color: "rose" as const, initials: "OC" },
	{
		name: "Marcus Johnson",
		role: "Engineering",
		color: "indigo" as const,
		initials: "MJ",
	},
	{ name: "Sofia Andersson", role: "Product", color: "cyan" as const, initials: "SA" },
	{ name: "James Wright", role: "Marketing", color: "orange" as const, initials: "JW" },
	{ name: "Priya Patel", role: "Design", color: "purple" as const, initials: "PP" },
	{ name: "Alex Kim", role: "Engineering", color: "teal" as const, initials: "AK" },
	{ name: "Emma Davis", role: "Research", color: "violet" as const, initials: "ED" },
	{ name: "Noah Garcia", role: "Engineering", color: "emerald" as const, initials: "NG" },
];

const meta = {
	title: "Components/Carousel",
	component: Carousel.Root,
	args: {},
	parameters: {
		layout: "padded",
	},
	tags: ["autodocs"],
} satisfies Meta<typeof Carousel.Root>;

export default meta;
type Story = StoryObj;

function MarkerDots({ count }: { count: number }) {
	return (
		<>
			{Array.from({ length: count }, (_, i) => (
				<Carousel.ScrollMarker
					key={i}
					index={i}
					render={(props, state) => (
						<button
							{...props}
							style={{
								width: 8,
								height: 8,
								borderRadius: "50%",
								border: "1.5px solid var(--gray-8)",
								background: state.active ? "var(--gray-12)" : "transparent",
								padding: 0,
								cursor: "pointer",
								transition: "background 150ms",
							}}
						/>
					)}
				/>
			))}
		</>
	);
}

function PersonCard({ person }: { person: (typeof people)[number] }) {
	return (
		<Card size="2" style={{ width: 220 }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: "var(--space-3)",
					padding: "var(--space-2) 0",
				}}
			>
				<Avatar size="5" fallback={person.initials} color={person.color} />
				<div style={{ textAlign: "center" }}>
					<Typography.Text render={<div />} size="2" weight="bold">
						{person.name}
					</Typography.Text>
					<div style={{ marginTop: "var(--space-1)" }}>
						<Badge size="1" variant="soft" color={person.color}>
							{person.role}
						</Badge>
					</div>
				</div>
			</div>
		</Card>
	);
}

export const Default: Story = {
	render: () => (
		<div style={{ maxWidth: 720 }}>
			<Carousel.Root defaultValue={0}>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "start", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	),
};

const colors = [
	"rose",
	"indigo",
	"cyan",
	"orange",
	"purple",
	"teal",
	"violet",
	"emerald",
] as const;

function makeItem(id: number) {
	const color = colors[id % colors.length];
	return { id, name: `Item ${id}`, color, initials: `${id}` };
}

function DynamicItemsDemo() {
	const nextId = useRef(2);
	const [items, setItems] = useState(() => [makeItem(0), makeItem(1)]);

	const prepend = () => {
		const id = nextId.current++;
		setItems((prev) => [makeItem(id), ...prev]);
	};

	const append = () => {
		const id = nextId.current++;
		setItems((prev) => [...prev, makeItem(id)]);
	};

	const removeFirst = () => setItems((prev) => prev.slice(1));
	const removeLast = () => setItems((prev) => prev.slice(0, -1));

	return (
		<div style={{ maxWidth: 720 }}>
			<div
				style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}
			>
				<Button size="1" variant="soft" onClick={prepend}>
					Prepend
				</Button>
				<Button
					size="1"
					variant="soft"
					color="red"
					onClick={removeFirst}
					disabled={items.length === 0}
				>
					Remove first
				</Button>
				<Button
					size="1"
					variant="soft"
					color="red"
					onClick={removeLast}
					disabled={items.length === 0}
				>
					Remove last
				</Button>
				<Button size="1" variant="soft" onClick={append}>
					Append
				</Button>
			</div>

			<Typography.Text
				render={<div />}
				size="1"
				color="gray"
				style={{ marginBottom: "var(--space-2)" }}
			>
				{items.length} item{items.length !== 1 && "s"}
			</Typography.Text>

			<Carousel.Root defaultValue={0}>
				<Carousel.Viewport
					aria-label="Dynamic items"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{items.map((item) => (
						<Carousel.Item key={item.id} style={{ scrollSnapAlign: "start", flexShrink: 0 }}>
							<Card size="2" style={{ width: 220 }}>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										gap: "var(--space-3)",
										padding: "var(--space-2) 0",
									}}
								>
									<Avatar size="5" fallback={item.initials} color={item.color} />
									<div style={{ textAlign: "center" }}>
										<Typography.Text render={<div />} size="2" weight="bold">
											{item.name}
										</Typography.Text>
										<div style={{ marginTop: "var(--space-1)" }}>
											<Badge size="1" variant="soft" color={item.color}>
												{item.color}
											</Badge>
										</div>
									</div>
								</div>
							</Card>
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose item"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={items.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	);
}

export const DynamicItems: Story = {
	render: () => <DynamicItemsDemo />,
};

export const WithoutScrollSnap: Story = {
	render: () => (
		<div style={{ maxWidth: 720 }}>
			<Carousel.Root defaultValue={0}>
				<Carousel.Viewport
					aria-label="Team members (no snap)"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item key={person.name} style={{ flexShrink: 0 }}>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	),
};

function ImperativeScrollToDemo() {
	const galleryRef = useRef<Carousel.CarouselRootRef>(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const [log, setLog] = useState<{ index: number; source: string }[]>([]);

	return (
		<div style={{ maxWidth: 720 }}>
			<div
				style={{
					display: "flex",
					gap: "var(--space-3)",
					alignItems: "center",
					marginBottom: "var(--space-3)",
				}}
			>
				<Typography.Text size="2">
					Active: <Typography.Code size="2">{activeIndex}</Typography.Code>
				</Typography.Text>
				<div style={{ display: "flex", gap: "var(--space-2)" }}>
					{people.map((_, i) => (
						<Button
							key={i}
							size="1"
							variant={activeIndex === i ? "solid" : "soft"}
							onClick={() => galleryRef.current?.scrollTo(i)}
						>
							{i}
						</Button>
					))}
				</div>
			</div>

			<Carousel.Root
				ref={galleryRef}
				onValueChange={(newValue, { source }) => {
					setActiveIndex(newValue);
					setLog((prev) => [{ index: newValue, source }, ...prev].slice(0, 10));
				}}
			>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "start", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>

			<div style={{ marginTop: "var(--space-4)" }}>
				<Typography.Text
					render={<div />}
					size="2"
					weight="bold"
					style={{ marginBottom: "var(--space-2)" }}
				>
					Event log
				</Typography.Text>
				<div
					style={{
						fontFamily: "var(--code-font-family)",
						fontSize: "var(--font-size-1)",
						lineHeight: "var(--line-height-2)",
						color: "var(--gray-11)",
						minHeight: 120,
					}}
				>
					{log.length === 0 ? (
						<Typography.Text size="1" color="gray">
							Scroll, click markers, or use the buttons above to see events…
						</Typography.Text>
					) : (
						log.map((entry, i) => (
							<div key={i}>
								index: <Typography.Code size="1">{entry.index}</Typography.Code> source:{" "}
								<Typography.Code size="1" color={entry.source === "scroll" ? "gray" : "indigo"}>
									{entry.source}
								</Typography.Code>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

export const ImperativeScrollTo: Story = {
	render: () => <ImperativeScrollToDemo />,
};

export const Vertical: Story = {
	render: () => (
		<div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start" }}>
			<Carousel.Root defaultValue={0} orientation="vertical">
				<div style={{ display: "flex", gap: "var(--space-3)" }}>
					<Carousel.Viewport
						aria-label="Team members"
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "var(--space-3)",
							overflowY: "auto",
							scrollSnapType: "y mandatory",
							scrollbarWidth: "none",
							height: 360,
						}}
					>
						{people.map((person) => (
							<Carousel.Item
								key={person.name}
								style={{ scrollSnapAlign: "start", flexShrink: 0 }}
							>
								<Card size="2" style={{ width: 260 }}>
									<div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
										<Avatar size="4" fallback={person.initials} color={person.color} />
										<div>
											<Typography.Text render={<div />} size="2" weight="bold">
												{person.name}
											</Typography.Text>
											<Badge size="1" variant="soft" color={person.color}>
												{person.role}
											</Badge>
										</div>
									</div>
								</Card>
							</Carousel.Item>
						))}
					</Carousel.Viewport>

					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "var(--space-2)",
						}}
					>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="1" color="gray" />}
						>
							<Icons.ChevronUp />
						</Carousel.Previous>

						<Carousel.ScrollMarkerGroup
							aria-label="Choose team member"
							style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}
						>
							<MarkerDots count={people.length} />
						</Carousel.ScrollMarkerGroup>

						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="1" color="gray" />}
						>
							<Icons.ChevronDown />
						</Carousel.Next>
					</div>
				</div>
			</Carousel.Root>
		</div>
	),
};

function DefaultValueDemo() {
	const [activeIndex, setActiveIndex] = useState(3);
	const [log, setLog] = useState<{ index: number; source: string }[]>([]);

	return (
		<div style={{ maxWidth: 720 }}>
			<div style={{ marginBottom: "var(--space-4)" }}>
				<Typography.Heading size="3" style={{ marginBottom: "var(--space-2)" }}>
					Default Value
				</Typography.Heading>
				<Typography.Text
					render={<p />}
					size="2"
					color="gray"
					style={{ maxWidth: 560, lineHeight: 1.6 }}
				>
					Use <Typography.Code size="2">defaultValue</Typography.Code> to initialize the
					gallery at a specific item. Here, the gallery starts at item{" "}
					<Typography.Strong>3</Typography.Strong> (James Wright) — the viewport scrolls there
					instantly on mount, and the corresponding marker is active. Pair with{" "}
					<Typography.Code size="2">onValueChange</Typography.Code> to track the active index
					as the user scrolls.
				</Typography.Text>
			</div>

			<Typography.Text
				render={<div />}
				size="1"
				color="gray"
				style={{ marginBottom: "var(--space-2)" }}
			>
				Active: <Typography.Code size="1">{activeIndex}</Typography.Code>
			</Typography.Text>

			<Carousel.Root
				defaultValue={3}
				onValueChange={(newValue, { source }) => {
					setActiveIndex(newValue);
					setLog((prev) => [{ index: newValue, source }, ...prev].slice(0, 10));
				}}
			>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "start", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>

			<div style={{ marginTop: "var(--space-4)" }}>
				<Typography.Text
					render={<div />}
					size="2"
					weight="bold"
					style={{ marginBottom: "var(--space-2)" }}
				>
					onValueChange log
				</Typography.Text>
				<div
					style={{
						fontFamily: "var(--code-font-family)",
						fontSize: "var(--font-size-1)",
						lineHeight: "var(--line-height-2)",
						color: "var(--gray-11)",
						minHeight: 120,
					}}
				>
					{log.length === 0 ? (
						<Typography.Text size="1" color="gray">
							Scroll or click markers to see events…
						</Typography.Text>
					) : (
						log.map((entry, i) => (
							<div key={i}>
								index: <Typography.Code size="1">{entry.index}</Typography.Code> source:{" "}
								<Typography.Code size="1" color={entry.source === "scroll" ? "gray" : "indigo"}>
									{entry.source}
								</Typography.Code>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}

export const DefaultValue: Story = {
	render: () => <DefaultValueDemo />,
};

export const StepByItem: Story = {
	render: () => (
		<div style={{ maxWidth: 720 }}>
			<div style={{ marginBottom: "var(--space-4)" }}>
				<Typography.Heading size="3" style={{ marginBottom: "var(--space-2)" }}>
					Step Navigation
				</Typography.Heading>
				<Typography.Text
					render={<p />}
					size="2"
					color="gray"
					style={{ maxWidth: 560, lineHeight: 1.6 }}
				>
					Pass <Typography.Code size="2">step=&#123;1&#125;</Typography.Code> to the Previous
					and Next buttons to scroll by one item at a time instead of by page. You can also use{" "}
					<Typography.Code size="2">step=&#123;2&#125;</Typography.Code> or any number to skip
					multiple items.
				</Typography.Text>
			</div>

			<Carousel.Root>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "start", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							step={1}
							aria-label="Previous item"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							step={1}
							aria-label="Next item"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	),
};

export const StepByItemNoSnap: Story = {
	render: () => (
		<div style={{ maxWidth: 720 }}>
			<div style={{ marginBottom: "var(--space-4)" }}>
				<Typography.Heading size="3" style={{ marginBottom: "var(--space-2)" }}>
					Step Navigation (No Snap)
				</Typography.Heading>
				<Typography.Text
					render={<p />}
					size="2"
					color="gray"
					style={{ maxWidth: 560, lineHeight: 1.6 }}
				>
					Step buttons work without scroll snapping too. The viewport scrolls to align the
					target item with the viewport start, but without{" "}
					<Typography.Code size="2">scroll-snap-type</Typography.Code> the scroll position
					won't snap after a manual trackpad swipe.
				</Typography.Text>
			</div>

			<Carousel.Root>
				<Carousel.Viewport
					aria-label="Team members (step, no snap)"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item key={person.name} style={{ flexShrink: 0 }}>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							step={1}
							aria-label="Previous item"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							step={1}
							aria-label="Next item"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	),
};

const productImages = [
	{
		id: 1,
		src: "https://picsum.photos/seed/shoe1/600/600",
		thumb: "https://picsum.photos/seed/shoe1/120/120",
		alt: "Product front view",
	},
	{
		id: 2,
		src: "https://picsum.photos/seed/shoe2/600/600",
		thumb: "https://picsum.photos/seed/shoe2/120/120",
		alt: "Product side view",
	},
	{
		id: 3,
		src: "https://picsum.photos/seed/shoe3/600/600",
		thumb: "https://picsum.photos/seed/shoe3/120/120",
		alt: "Product back view",
	},
	{
		id: 4,
		src: "https://picsum.photos/seed/shoe4/600/600",
		thumb: "https://picsum.photos/seed/shoe4/120/120",
		alt: "Product detail",
	},
	{
		id: 5,
		src: "https://picsum.photos/seed/shoe5/600/600",
		thumb: "https://picsum.photos/seed/shoe5/120/120",
		alt: "Product on model",
	},
	{
		id: 6,
		src: "https://picsum.photos/seed/shoe6/600/600",
		thumb: "https://picsum.photos/seed/shoe6/120/120",
		alt: "Product packaging",
	},
];

function ProductGalleryDemo() {
	return (
		<div style={{ maxWidth: 900 }}>
			<div style={{ display: "flex", gap: "var(--space-6)", alignItems: "flex-start" }}>
				{/* Left: Image gallery */}
				<div style={{ flex: "0 0 480px" }}>
					<Carousel.Root loop>
						{/* Main image with overlay nav buttons */}
						<div style={{ position: "relative" }}>
							<Carousel.Viewport
								aria-label="Product images"
								style={{
									display: "flex",
									overflowX: "auto",
									overscrollBehaviorX: "contain",
									scrollSnapType: "x mandatory",
									scrollbarWidth: "none",
									borderRadius: "var(--radius-3)",
									background: "var(--gray-3)",
								}}
							>
								{productImages.map((img) => (
									<Carousel.Item
										key={img.id}
										style={{ scrollSnapAlign: "center", flexShrink: 0, width: "100%" }}
									>
										<img
											src={img.src}
											alt={img.alt}
											style={{ width: "100%", height: 480, objectFit: "cover", display: "block" }}
										/>
									</Carousel.Item>
								))}
							</Carousel.Viewport>

							<Carousel.Previous
								step={1}
								tabIndex={-1}
								aria-label="Previous image"
								style={{
									color: "white",
									background: "rgba(255,255,255,0.2)",
									backdropFilter: "blur(8px) invert(0.3) brightness(0.9) saturate(180%)",
									boxShadow: "0 2px 8px 0 rgba(0,0,0,0.10), 0 1.5px 8px 0 rgba(0,0,0,0.13)",
									width: 32,
									height: 32,
									borderRadius: "50%",
									position: "absolute",
									left: "var(--space-3)",
									top: "50%",
									transform: "translateY(-50%)",
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
								}}
							>
								<Icons.ChevronLeft />
							</Carousel.Previous>

							<Carousel.Next
								step={1}
								tabIndex={-1}
								aria-label="Next image"
								style={{
									color: "white",
									background: "rgba(255,255,255,0.2)",
									backdropFilter: "blur(8px) invert(0.3) brightness(0.9) saturate(180%)",
									boxShadow: "0 2px 8px 0 rgba(0,0,0,0.10), 0 1.5px 8px 0 rgba(0,0,0,0.13)",
									width: 32,
									height: 32,
									borderRadius: "50%",
									position: "absolute",
									right: "var(--space-3)",
									top: "50%",
									transform: "translateY(-50%)",
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
								}}
							>
								<Icons.ChevronRight />
							</Carousel.Next>
						</div>

						{/* Dash markers — purely visual, not focusable (thumbnails handle keyboard nav) */}
						<Carousel.ScrollMarkerGroup
							aria-hidden="true"
							tabIndex={-1}
							style={{
								display: "flex",
								justifyContent: "center",
								gap: "var(--space-2)",
								marginTop: "var(--space-3)",
							}}
						>
							{productImages.map((_, i) => (
								<Carousel.ScrollMarker
									key={i}
									index={i}
									render={(props, state) => (
										<button
											{...props}
											tabIndex={-1}
											style={{
												width: 24,
												height: 3,
												borderRadius: 2,
												border: "none",
												background: state.active ? "var(--gray-12)" : "var(--gray-6)",
												padding: 0,
												cursor: "pointer",
												transition: "background 150ms",
											}}
										/>
									)}
								/>
							))}
						</Carousel.ScrollMarkerGroup>

						{/* Thumbnail markers */}
						<Carousel.ScrollMarkerGroup
							aria-label="Product thumbnails"
							style={{
								display: "flex",
								gap: "var(--space-2)",
								marginTop: "var(--space-3)",
							}}
						>
							{productImages.map((img, i) => (
								<Carousel.ScrollMarker
									key={img.id}
									index={i}
									render={(props, state) => (
										<button
											{...props}
											style={{
												flexShrink: 0,
												width: 80,
												height: 80,
												borderRadius: "var(--radius-2)",
												overflow: "hidden",
												border: state.active ? "2px solid var(--gray-12)" : "2px solid transparent",
												padding: 0,
												cursor: "pointer",
												opacity: state.active ? 1 : 0.6,
												transition: "opacity 150ms, border-color 150ms",
												background: "none",
											}}
										>
											<img
												src={img.thumb}
												alt={img.alt}
												style={{
													width: "100%",
													height: "100%",
													objectFit: "cover",
													display: "block",
												}}
											/>
										</button>
									)}
								/>
							))}
						</Carousel.ScrollMarkerGroup>
					</Carousel.Root>
				</div>
			</div>
		</div>
	);
}

export const ProductGallery: Story = {
	render: () => <ProductGalleryDemo />,
};

export const Loop: Story = {
	render: () => (
		<div style={{ maxWidth: 720 }}>
			<div style={{ marginBottom: "var(--space-4)" }}>
				<Typography.Heading size="3" weight="bold" style={{ marginBottom: "var(--space-1)" }}>
					Loop
				</Typography.Heading>
				<Typography.Text render={<p />} size="2" color="gray">
					With <Typography.Code size="2">loop</Typography.Code> enabled, the Previous and Next
					buttons never disable. Clicking Next at the end wraps to the first item, and Previous
					at the start wraps to the last. Arrow keys on markers also wrap.
				</Typography.Text>
			</div>

			<Carousel.Root loop>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "start", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	),
};

export const LoopStepByItem: Story = {
	render: () => (
		<div style={{ maxWidth: 720 }}>
			<div style={{ marginBottom: "var(--space-4)" }}>
				<Typography.Heading size="3" weight="bold" style={{ marginBottom: "var(--space-1)" }}>
					Loop + Step by Item
				</Typography.Heading>
				<Typography.Text render={<p />} size="2" color="gray">
					Combining <Typography.Code size="2">loop</Typography.Code> with{" "}
					<Typography.Code size="2">step={"{1}"}</Typography.Code> on the buttons. Each click
					advances one item, and wraps at the boundaries.
				</Typography.Text>
			</div>

			<Carousel.Root loop>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "start", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							step={1}
							aria-label="Previous item"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							step={1}
							aria-label="Next item"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	),
};
export const ResizableViewport: Story = {
	render: () => (
		<div
			style={{
				width: 720,
				minWidth: 200,
				maxWidth: "100%",
				resize: "horizontal",
				overflow: "hidden",
				border: "1px dashed var(--gray-6)",
				borderRadius: "var(--radius-3)",
				padding: "var(--space-4)",
			}}
		>
			<Typography.Text
				size="1"
				color="gray"
				render={<div />}
				style={{ marginBottom: "var(--space-3)" }}
			>
				Drag the bottom-right corner to resize
			</Typography.Text>
			<Carousel.Root>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "start", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	),
};

export const SnapToCenter: Story = {
	render: () => (
		<div style={{ maxWidth: 720 }}>
			<Carousel.Root defaultValue={3}>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "center", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							step={1}
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							step={1}
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>
		</div>
	),
};

// ---------------------------------------------------------------------------
// Controlled Mode (value prop)
// ---------------------------------------------------------------------------

function ControlledValueDemo() {
	const [activeIndex, setActiveIndex] = useState(0);

	return (
		<div style={{ maxWidth: 720 }}>
			<div style={{ marginBottom: "var(--space-4)" }}>
				<Typography.Heading size="3" style={{ marginBottom: "var(--space-2)" }}>
					Controlled Mode
				</Typography.Heading>
				<Typography.Text
					render={<p />}
					size="2"
					color="gray"
					style={{ maxWidth: 560, lineHeight: 1.6 }}
				>
					Pass the <Typography.Code size="2">value</Typography.Code> prop to fully control
					which item is active. External state changes automatically scroll the viewport to the
					corresponding item. Use <Typography.Code size="2">onValueChange</Typography.Code> to
					keep your state in sync when the user scrolls natively. Unlike{" "}
					<Typography.Code size="2">defaultValue</Typography.Code>, the gallery never updates
					its own index — your state is the single source of truth.
				</Typography.Text>
			</div>

			<div
				style={{
					display: "flex",
					gap: "var(--space-3)",
					alignItems: "center",
					marginBottom: "var(--space-3)",
				}}
			>
				<Typography.Text size="2">
					External state: <Typography.Code size="2">{activeIndex}</Typography.Code>
				</Typography.Text>
				<div style={{ display: "flex", gap: "var(--space-2)" }}>
					{people.map((person, i) => (
						<Button
							key={i}
							size="1"
							variant={activeIndex === i ? "solid" : "soft"}
							color={person.color}
							onClick={() => setActiveIndex(i)}
						>
							{i}
						</Button>
					))}
				</div>
			</div>

			<Carousel.Root value={activeIndex} onValueChange={(v) => setActiveIndex(v)}>
				<Carousel.Viewport
					aria-label="Team members"
					style={{
						display: "flex",
						gap: "var(--space-3)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
					}}
				>
					{people.map((person) => (
						<Carousel.Item
							key={person.name}
							style={{ scrollSnapAlign: "start", flexShrink: 0 }}
						>
							<PersonCard person={person} />
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginTop: "var(--space-3)",
					}}
				>
					<div style={{ display: "flex", gap: "var(--space-2)" }}>
						<Carousel.Previous
							aria-label="Previous"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.Next
							aria-label="Next"
							render={<IconButton variant="soft" size="2" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>

					<Carousel.ScrollMarkerGroup
						aria-label="Choose team member"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={people.length} />
					</Carousel.ScrollMarkerGroup>
				</div>
			</Carousel.Root>

			<Typography.Text
				render={<p />}
				size="1"
				color="gray"
				style={{ marginTop: "var(--space-3)", lineHeight: 1.6 }}
			>
				Click the numbered buttons above to change the value externally — the gallery scrolls
				to match. Scroll the gallery manually and the buttons update in sync. Both directions
				stay smooth with no feedback-loop jank.
			</Typography.Text>
		</div>
	);
}

export const ControlledValue: Story = {
	name: "Controlled (value)",
	render: () => <ControlledValueDemo />,
};

// ---------------------------------------------------------------------------
// Real-world demo: Testimonials
// ---------------------------------------------------------------------------

const testimonials = [
	{
		quote:
			"This design system has completely transformed how we build products. The component quality is unmatched.",
		author: "Sarah Chen",
		title: "VP of Engineering, Acme Corp",
		initials: "SC",
		color: "rose" as const,
		rating: 5,
	},
	{
		quote:
			"We cut our development time in half after adopting this library. The APIs are intuitive and the components are rock solid.",
		author: "David Park",
		title: "Lead Developer, Nexus Labs",
		initials: "DP",
		color: "indigo" as const,
		rating: 5,
	},
	{
		quote:
			"The attention to accessibility out of the box saved our team weeks of work. Truly best-in-class primitives.",
		author: "Maria Gonzalez",
		title: "Head of Product, Orbit.io",
		initials: "MG",
		color: "teal" as const,
		rating: 5,
	},
	{
		quote:
			"Finally a component library that doesn't fight you on styling. Headless where it matters, polished where you need it.",
		author: "James Liu",
		title: "Senior Engineer, CloudBase",
		initials: "JL",
		color: "orange" as const,
		rating: 4,
	},
	{
		quote:
			"We migrated from three different UI libraries to just this one. Our bundle size dropped by 40% and DX went through the roof.",
		author: "Amara Osei",
		title: "CTO, Paystack",
		initials: "AO",
		color: "purple" as const,
		rating: 5,
	},
];

export const ScrollBehavior: Story = {
	render: function ScrollBehaviorStory() {
		const [behavior, setBehavior] = useState<"smooth" | "instant">("smooth");

		return (
			<div style={{ maxWidth: 600 }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "var(--space-3)",
						marginBottom: "var(--space-4)",
					}}
				>
					<Typography.Text size="2" weight="medium">
						Scroll behavior:
					</Typography.Text>
					<Button
						size="1"
						variant={behavior === "smooth" ? "solid" : "surface"}
						onClick={() => setBehavior("smooth")}
					>
						Smooth
					</Button>
					<Button
						size="1"
						variant={behavior === "instant" ? "solid" : "surface"}
						onClick={() => setBehavior("instant")}
					>
						Instant
					</Button>
					<Typography.Code
						size="1"
						color="gray"
					>{`scrollBehavior="${behavior}"`}</Typography.Code>
				</div>

				<Carousel.Root scrollBehavior={behavior}>
					<Carousel.Viewport
						style={{
							display: "flex",
							gap: "var(--space-3)",
							overflowX: "auto",
							scrollSnapType: "x mandatory",
							scrollbarWidth: "none",
						}}
					>
						{people.map((person) => (
							<Carousel.Item
								key={person.name}
								style={{ scrollSnapAlign: "start", flexShrink: 0, width: 200 }}
							>
								<Card>
									<div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
										<Avatar size="3" fallback={person.initials} color={person.color} />
										<div>
											<Typography.Text render={<div />} size="2" weight="bold">
												{person.name}
											</Typography.Text>
											<Typography.Text render={<div />} size="1" color="gray">
												{person.role}
											</Typography.Text>
										</div>
									</div>
								</Card>
							</Carousel.Item>
						))}
					</Carousel.Viewport>

					<div
						style={{
							display: "flex",
							justifyContent: "center",
							alignItems: "center",
							gap: "var(--space-4)",
							marginTop: "var(--space-3)",
						}}
					>
						<Carousel.Previous
							step={1}
							render={<IconButton variant="surface" size="1" color="gray" />}
						>
							<Icons.ChevronLeft />
						</Carousel.Previous>
						<Carousel.ScrollMarkerGroup style={{ display: "flex", gap: "var(--space-1)" }}>
							<MarkerDots count={people.length} />
						</Carousel.ScrollMarkerGroup>
						<Carousel.Next
							step={1}
							render={<IconButton variant="surface" size="1" color="gray" />}
						>
							<Icons.ChevronRight />
						</Carousel.Next>
					</div>
				</Carousel.Root>
			</div>
		);
	},
};

export const Testimonials: Story = {
	render: () => (
		<div style={{ maxWidth: 800 }}>
			<div style={{ textAlign: "center", marginBottom: "var(--space-5)" }}>
				<Typography.Heading size="5" weight="bold">
					What people are saying
				</Typography.Heading>
				<Typography.Text
					render={<p />}
					size="2"
					color="gray"
					style={{ marginTop: "var(--space-2)" }}
				>
					Trusted by teams at companies of all sizes.
				</Typography.Text>
			</div>

			<Carousel.Root>
				<Carousel.Viewport
					aria-label="Customer testimonials"
					style={{
						display: "flex",
						gap: "var(--space-4)",
						overflowX: "auto",
						overscrollBehaviorX: "contain",
						scrollSnapType: "x mandatory",
						scrollbarWidth: "none",
						paddingInline: "calc(50% - 170px)",
						maskImage:
							"linear-gradient(to right, transparent, black 170px, black calc(100% - 170px), transparent)",
						paddingBlock: "var(--space-1)",
					}}
				>
					{testimonials.map((t) => (
						<Carousel.Item
							key={t.author}
							style={{ scrollSnapAlign: "center", flexShrink: 0, width: 340 }}
						>
							<Card size="3" style={{ height: "100%" }}>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "var(--space-3)",
										height: "100%",
									}}
								>
									<div style={{ display: "flex", gap: 2 }}>
										{Array.from({ length: 5 }, (_, i) => (
											<span
												key={i}
												style={{
													color: i < t.rating ? "var(--amber-9)" : "var(--gray-5)",
													fontSize: 14,
												}}
											>
												★
											</span>
										))}
									</div>
									<Typography.Text size="2" style={{ flex: 1, lineHeight: 1.6 }}>
										&ldquo;{t.quote}&rdquo;
									</Typography.Text>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "var(--space-3)",
											marginTop: "auto",
										}}
									>
										<Avatar size="3" fallback={t.initials} color={t.color} />
										<div>
											<Typography.Text render={<div />} size="2" weight="bold">
												{t.author}
											</Typography.Text>
											<Typography.Text render={<div />} size="1" color="gray">
												{t.title}
											</Typography.Text>
										</div>
									</div>
								</div>
							</Card>
						</Carousel.Item>
					))}
				</Carousel.Viewport>

				<div
					style={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						gap: "var(--space-4)",
						marginTop: "var(--space-4)",
					}}
				>
					<Carousel.Previous
						step={1}
						aria-label="Previous testimonial"
						render={<IconButton variant="surface" size="2" color="gray" />}
					>
						<Icons.ChevronLeft />
					</Carousel.Previous>

					<Carousel.ScrollMarkerGroup
						aria-label="Testimonial pages"
						style={{ display: "flex", gap: "var(--space-1)" }}
					>
						<MarkerDots count={testimonials.length} />
					</Carousel.ScrollMarkerGroup>

					<Carousel.Next
						step={1}
						aria-label="Next testimonial"
						render={<IconButton variant="surface" size="2" color="gray" />}
					>
						<Icons.ChevronRight />
					</Carousel.Next>
				</div>
			</Carousel.Root>
		</div>
	),
};
