<script lang="ts" module>
	import { cn } from '$lib/utils/cn';

	export type ButtonVariant =
		| 'default'
		| 'destructive'
		| 'outline'
		| 'secondary'
		| 'ghost'
		| 'link';
	export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

	export const buttonVariants = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/90',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		ghost: 'hover:bg-accent hover:text-accent-foreground',
		link: 'text-primary underline-offset-4 hover:underline'
	};

	export const buttonSizes = {
		default: 'h-10 px-4 py-2',
		sm: 'h-9 rounded-md px-3',
		lg: 'h-11 rounded-md px-8',
		icon: 'h-10 w-10'
	};
</script>

<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface Props extends HTMLButtonAttributes {
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	}

	let {
		variant = 'default',
		size = 'default',
		class: className,
		children,
		...restProps
	}: Props = $props();
</script>

<button
	class={cn(
		'ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
		buttonVariants[variant],
		buttonSizes[size],
		className
	)}
	{...restProps}
>
	{@render children?.()}
</button>
