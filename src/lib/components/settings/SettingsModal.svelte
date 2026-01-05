<script lang="ts">
	import { settingsStore } from '$lib/stores/settings.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Separator from '$lib/components/ui/separator.svelte';
	import { X, Upload, Trash2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open, onclose }: Props = $props();

	let activeTab = $state<'typography' | 'layout' | 'header' | 'headings' | 'theme' | 'mermaid'>(
		'typography'
	);

	function handleLogoUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			settingsStore.setLogo(dataUrl);
		};
		reader.readAsDataURL(file);
	}

	function removeLogo() {
		settingsStore.setLogo(undefined);
	}

	function resetSettings() {
		if (confirm('Reset all settings to defaults?')) {
			settingsStore.reset();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			onclose();
		}
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-transparent"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-background max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg shadow-xl"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="border-border flex items-center justify-between border-b p-4">
				<h2 id="settings-title" class="text-lg font-semibold">
					{i18n.t.settings.title}
				</h2>
				<Button variant="ghost" size="icon" onclick={onclose}>
					<X class="h-4 w-4" />
				</Button>
			</div>

			<!-- Tabs -->
			<div class="border-border flex border-b" role="tablist">
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'typography'}
					class="px-4 py-2 text-sm {activeTab === 'typography'
						? 'border-primary border-b-2 font-medium'
						: 'text-muted-foreground'}"
					onclick={() => (activeTab = 'typography')}
				>
					{i18n.t.settings.typography}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'layout'}
					class="px-4 py-2 text-sm {activeTab === 'layout'
						? 'border-primary border-b-2 font-medium'
						: 'text-muted-foreground'}"
					onclick={() => (activeTab = 'layout')}
				>
					{i18n.t.settings.pageLayout}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'header'}
					class="px-4 py-2 text-sm {activeTab === 'header'
						? 'border-primary border-b-2 font-medium'
						: 'text-muted-foreground'}"
					onclick={() => (activeTab = 'header')}
				>
					{i18n.t.settings.headerFooter}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'headings'}
					class="px-4 py-2 text-sm {activeTab === 'headings'
						? 'border-primary border-b-2 font-medium'
						: 'text-muted-foreground'}"
					onclick={() => (activeTab = 'headings')}
				>
					{i18n.t.settings.headings}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'theme'}
					class="px-4 py-2 text-sm {activeTab === 'theme'
						? 'border-primary border-b-2 font-medium'
						: 'text-muted-foreground'}"
					onclick={() => (activeTab = 'theme')}
				>
					{i18n.t.settings.themeColors}
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={activeTab === 'mermaid'}
					class="px-4 py-2 text-sm {activeTab === 'mermaid'
						? 'border-primary border-b-2 font-medium'
						: 'text-muted-foreground'}"
					onclick={() => (activeTab = 'mermaid')}
				>
					Diagrams
				</button>
			</div>

			<!-- Content -->
			<div class="max-h-[60vh] overflow-auto p-4" role="tabpanel">
				{#if activeTab === 'typography'}
					<div class="space-y-4">
						<div>
							<label for="font-family" class="mb-1 block text-sm font-medium"
								>{i18n.t.settings.fontFamily}</label
							>
							<select
								id="font-family"
								class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
								value={settingsStore.current.fontFamily}
								onchange={(e) => settingsStore.update({ fontFamily: e.currentTarget.value })}
							>
								<optgroup label="Bundled Fonts">
									<option value="Cairo">Cairo (Arabic)</option>
								</optgroup>
								<optgroup label="System Fonts - Arabic">
									<option value="Helvetica Neue LT Arabic">Helvetica Neue LT Arabic</option>
									<option value="SF Arabic">SF Arabic (macOS)</option>
									<option value="Segoe UI">Segoe UI (Windows)</option>
									<option value="Tahoma">Tahoma</option>
								</optgroup>
								<optgroup label="System Fonts - General">
									<option value="Arial">Arial</option>
									<option value="Helvetica Neue">Helvetica Neue</option>
									<option value="Georgia">Georgia</option>
									<option value="Times New Roman">Times New Roman</option>
									<option value="Verdana">Verdana</option>
									<option value="system-ui">System Default</option>
								</optgroup>
							</select>
						</div>

						<div>
							<label for="font-size" class="mb-1 block text-sm font-medium"
								>{i18n.t.settings.fontSize} (pt)</label
							>
							<Input
								id="font-size"
								type="number"
								min="8"
								max="16"
								value={settingsStore.current.fontSize.toString()}
								onchange={(e) =>
									settingsStore.update({
										fontSize: parseInt(e.currentTarget.value) || 10
									})}
							/>
						</div>

						<div>
							<label for="line-height" class="mb-1 block text-sm font-medium"
								>{i18n.t.settings.lineHeight}</label
							>
							<Input
								id="line-height"
								type="number"
								min="1"
								max="3"
								step="0.1"
								value={settingsStore.current.lineHeight.toString()}
								onchange={(e) =>
									settingsStore.update({
										lineHeight: parseFloat(e.currentTarget.value) || 1.6
									})}
							/>
						</div>
					</div>
				{:else if activeTab === 'layout'}
					<div class="space-y-4">
						<div>
							<label for="page-size" class="mb-1 block text-sm font-medium"
								>{i18n.t.settings.pageSize}</label
							>
							<select
								id="page-size"
								class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
								value={settingsStore.current.pageSize}
								onchange={(e) =>
									settingsStore.update({
										pageSize: e.currentTarget.value as 'A4' | 'Letter' | 'Legal'
									})}
							>
								<option value="A4">A4</option>
								<option value="Letter">Letter</option>
								<option value="Legal">Legal</option>
								<option value="Canvas">Canvas (Continuous)</option>
							</select>
						</div>

						<Separator />

						<fieldset>
							<legend class="mb-2 text-sm font-medium">{i18n.t.settings.margins}</legend>
							<div class="grid grid-cols-2 gap-3">
								<div>
									<label for="margin-top" class="text-muted-foreground mb-1 block text-xs"
										>{i18n.t.settings.top}</label
									>
									<Input
										id="margin-top"
										value={settingsStore.current.margins.top}
										onchange={(e) =>
											settingsStore.update({
												margins: {
													...settingsStore.current.margins,
													top: e.currentTarget.value
												}
											})}
									/>
								</div>
								<div>
									<label for="margin-bottom" class="text-muted-foreground mb-1 block text-xs"
										>{i18n.t.settings.bottom}</label
									>
									<Input
										id="margin-bottom"
										value={settingsStore.current.margins.bottom}
										onchange={(e) =>
											settingsStore.update({
												margins: {
													...settingsStore.current.margins,
													bottom: e.currentTarget.value
												}
											})}
									/>
								</div>
								<div>
									<label for="margin-left" class="text-muted-foreground mb-1 block text-xs"
										>{i18n.t.settings.left}</label
									>
									<Input
										id="margin-left"
										value={settingsStore.current.margins.left}
										onchange={(e) =>
											settingsStore.update({
												margins: {
													...settingsStore.current.margins,
													left: e.currentTarget.value
												}
											})}
									/>
								</div>
								<div>
									<label for="margin-right" class="text-muted-foreground mb-1 block text-xs"
										>{i18n.t.settings.right}</label
									>
									<Input
										id="margin-right"
										value={settingsStore.current.margins.right}
										onchange={(e) =>
											settingsStore.update({
												margins: {
													...settingsStore.current.margins,
													right: e.currentTarget.value
												}
											})}
									/>
								</div>
							</div>
						</fieldset>
					</div>
				{:else if activeTab === 'header'}
					<div class="space-y-6">
						<!-- Header Settings -->
						<fieldset class="space-y-4">
							<legend class="font-medium">{i18n.t.settings.header}</legend>

							<div class="flex items-center gap-2">
								<input
									type="checkbox"
									id="header-enabled"
									checked={settingsStore.current.header.enabled}
									onchange={(e) =>
										settingsStore.updateHeader({
											enabled: e.currentTarget.checked
										})}
									class="border-input rounded"
								/>
								<label for="header-enabled" class="text-sm">{i18n.t.settings.enabled}</label>
							</div>

							{#if settingsStore.current.header.enabled}
								<div>
									<span class="mb-1 block text-sm font-medium">{i18n.t.settings.logo}</span>
									{#if settingsStore.current.header.logo}
										<div class="flex items-center gap-2">
											<img
												src={settingsStore.current.header.logo}
												alt="Logo"
												class="h-12 w-auto rounded border"
											/>
											<Button variant="outline" size="sm" onclick={removeLogo}>
												<Trash2 class="mr-1 h-3 w-3" />
												{i18n.t.settings.removeLogo}
											</Button>
										</div>
									{:else}
										<label
											for="logo-upload"
											class="border-input hover:bg-accent flex cursor-pointer items-center gap-2 rounded border border-dashed px-4 py-3"
										>
											<Upload class="h-4 w-4" />
											<span class="text-sm">{i18n.t.settings.uploadLogo}</span>
											<input
												id="logo-upload"
												type="file"
												accept="image/*"
												class="hidden"
												onchange={handleLogoUpload}
											/>
										</label>
									{/if}
								</div>

								<div>
									<label for="logo-position" class="mb-1 block text-sm font-medium"
										>{i18n.t.settings.logoPosition}</label
									>
									<select
										id="logo-position"
										class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
										value={settingsStore.current.header.logoPosition}
										onchange={(e) =>
											settingsStore.updateHeader({
												logoPosition: e.currentTarget.value as 'left' | 'center' | 'right'
											})}
									>
										<option value="left">{i18n.direction === 'rtl' ? 'Right' : 'Left'}</option>
										<option value="center">Center</option>
										<option value="right">{i18n.direction === 'rtl' ? 'Left' : 'Right'}</option>
									</select>
								</div>

								<div>
									<label for="header-text" class="mb-1 block text-sm font-medium"
										>{i18n.t.settings.customText}</label
									>
									<Input
										id="header-text"
										value={settingsStore.current.header.text || ''}
										placeholder="Optional header text"
										onchange={(e) =>
											settingsStore.updateHeader({
												text: e.currentTarget.value || undefined
											})}
									/>
								</div>

								<div class="flex items-center gap-2">
									<input
										type="checkbox"
										id="show-first-page"
										checked={settingsStore.current.header.showOnFirstPage}
										onchange={(e) =>
											settingsStore.updateHeader({
												showOnFirstPage: e.currentTarget.checked
											})}
										class="border-input rounded"
									/>
									<label for="show-first-page" class="text-sm"
										>{i18n.t.settings.showOnFirstPage}</label
									>
								</div>
							{/if}
						</fieldset>

						<Separator />

						<!-- Footer Settings -->
						<fieldset class="space-y-4">
							<legend class="font-medium">{i18n.t.settings.footer}</legend>

							<div class="flex items-center gap-2">
								<input
									type="checkbox"
									id="footer-enabled"
									checked={settingsStore.current.footer.enabled}
									onchange={(e) =>
										settingsStore.updateFooter({
											enabled: e.currentTarget.checked
										})}
									class="border-input rounded"
								/>
								<label for="footer-enabled" class="text-sm">{i18n.t.settings.enabled}</label>
							</div>

							{#if settingsStore.current.footer.enabled}
								<div class="flex items-center gap-2">
									<input
										type="checkbox"
										id="show-page-numbers"
										checked={settingsStore.current.footer.showPageNumbers}
										onchange={(e) =>
											settingsStore.updateFooter({
												showPageNumbers: e.currentTarget.checked
											})}
										class="border-input rounded"
									/>
									<label for="show-page-numbers" class="text-sm"
										>{i18n.t.settings.pageNumbers}</label
									>
								</div>

								{#if settingsStore.current.footer.showPageNumbers}
									<div>
										<label for="page-number-format" class="mb-1 block text-sm font-medium"
											>{i18n.t.settings.pageNumberFormat}</label
										>
										<select
											id="page-number-format"
											class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
											value={settingsStore.current.footer.pageNumberFormat}
											onchange={(e) =>
												settingsStore.updateFooter({
													pageNumberFormat: e.currentTarget.value as
														| '1'
														| '1/N'
														| 'Page 1'
														| 'صفحة 1'
												})}
										>
											<option value="1">1, 2, 3...</option>
											<option value="1/N">1/10, 2/10...</option>
											<option value="Page 1">Page 1, Page 2...</option>
											<option value="صفحة 1">صفحة 1، صفحة 2...</option>
										</select>
									</div>
								{/if}

								<div>
									<label for="footer-text" class="mb-1 block text-sm font-medium"
										>{i18n.t.settings.customText}</label
									>
									<Input
										id="footer-text"
										value={settingsStore.current.footer.customText || ''}
										placeholder="Optional footer text"
										onchange={(e) =>
											settingsStore.updateFooter({
												customText: e.currentTarget.value || undefined
											})}
									/>
								</div>
							{/if}
						</fieldset>
					</div>
				{:else if activeTab === 'headings'}
					<div class="space-y-4">
						{#each ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as level}
							{@const heading =
								settingsStore.current.headings[
									level as keyof typeof settingsStore.current.headings
								]}
							<fieldset class="border-border rounded border p-3">
								<legend class="px-1 font-medium">{level.toUpperCase()}</legend>
								<div class="grid grid-cols-3 gap-3">
									<div>
										<label for="{level}-color" class="text-muted-foreground mb-1 block text-xs"
											>{i18n.t.settings.color}</label
										>
										<div class="flex gap-2">
											<input
												type="color"
												id="{level}-color"
												value={heading.color}
												onchange={(e) =>
													settingsStore.updateHeading(
														level as keyof typeof settingsStore.current.headings,
														{ color: e.currentTarget.value }
													)}
												class="border-input h-8 w-12 cursor-pointer rounded border"
											/>
											<Input
												value={heading.color}
												class="flex-1"
												aria-label="{level} color hex"
												onchange={(e) =>
													settingsStore.updateHeading(
														level as keyof typeof settingsStore.current.headings,
														{ color: e.currentTarget.value }
													)}
											/>
										</div>
									</div>
									<div>
										<label for="{level}-fontsize" class="text-muted-foreground mb-1 block text-xs"
											>{i18n.t.settings.fontSize}</label
										>
										<Input
											id="{level}-fontsize"
											value={heading.fontSize}
											onchange={(e) =>
												settingsStore.updateHeading(
													level as keyof typeof settingsStore.current.headings,
													{ fontSize: e.currentTarget.value }
												)}
										/>
									</div>
									<div class="flex items-end">
										<div class="flex items-center gap-2">
											<input
												type="checkbox"
												id="{level}-border"
												checked={heading.borderBottom}
												onchange={(e) =>
													settingsStore.updateHeading(
														level as keyof typeof settingsStore.current.headings,
														{ borderBottom: e.currentTarget.checked }
													)}
												class="border-input rounded"
											/>
											<label for="{level}-border" class="text-xs"
												>{i18n.t.settings.borderBottom}</label
											>
										</div>
									</div>
								</div>
							</fieldset>
						{/each}
					</div>
				{:else if activeTab === 'theme'}
					<!-- Theme Colors Tab -->
					<div class="space-y-4">
						<div class="grid grid-cols-2 gap-4">
							<!-- Table Header Color -->
							<div>
								<label for="table-header-color" class="mb-1 block text-sm font-medium">
									{i18n.t.settings.tableHeader}
								</label>
								<div class="flex gap-2">
									<input
										type="color"
										id="table-header-color"
										value={settingsStore.current.theme?.tableHeader ||
											settingsStore.current.headings.h1.color}
										onchange={(e) =>
											settingsStore.updateTheme({
												tableHeader: e.currentTarget.value
											})}
										class="border-input h-8 w-12 cursor-pointer rounded border"
									/>
									<Input
										value={settingsStore.current.theme?.tableHeader ||
											settingsStore.current.headings.h1.color}
										class="flex-1"
										onchange={(e) =>
											settingsStore.updateTheme({
												tableHeader: e.currentTarget.value
											})}
									/>
								</div>
							</div>

							<!-- Links Color -->
							<div>
								<label for="link-color" class="mb-1 block text-sm font-medium">
									{i18n.t.settings.links}
								</label>
								<div class="flex gap-2">
									<input
										type="color"
										id="link-color"
										value={settingsStore.current.theme?.links ||
											settingsStore.current.headings.h2.color}
										onchange={(e) =>
											settingsStore.updateTheme({
												links: e.currentTarget.value
											})}
										class="border-input h-8 w-12 cursor-pointer rounded border"
									/>
									<Input
										value={settingsStore.current.theme?.links ||
											settingsStore.current.headings.h2.color}
										class="flex-1"
										onchange={(e) =>
											settingsStore.updateTheme({
												links: e.currentTarget.value
											})}
									/>
								</div>
							</div>

							<!-- Blockquote Color -->
							<div>
								<label for="quote-color" class="mb-1 block text-sm font-medium">
									{i18n.t.settings.blockquotes}
								</label>
								<div class="flex gap-2">
									<input
										type="color"
										id="quote-color"
										value={settingsStore.current.theme?.blockquotes ||
											settingsStore.current.headings.h2.color}
										onchange={(e) =>
											settingsStore.updateTheme({
												blockquotes: e.currentTarget.value
											})}
										class="border-input h-8 w-12 cursor-pointer rounded border"
									/>
									<Input
										value={settingsStore.current.theme?.blockquotes ||
											settingsStore.current.headings.h2.color}
										class="flex-1"
										onchange={(e) =>
											settingsStore.updateTheme({
												blockquotes: e.currentTarget.value
											})}
									/>
								</div>
							</div>

							<!-- Code Block Color -->
							<div>
								<label for="code-color" class="mb-1 block text-sm font-medium">
									{i18n.t.settings.codeBlock}
								</label>
								<div class="flex gap-2">
									<input
										type="color"
										id="code-color"
										value={settingsStore.current.theme?.codeBlock || '#f8f8f8'}
										onchange={(e) =>
											settingsStore.updateTheme({
												codeBlock: e.currentTarget.value
											})}
										class="border-input h-8 w-12 cursor-pointer rounded border"
									/>
									<Input
										value={settingsStore.current.theme?.codeBlock || '#f8f8f8'}
										class="flex-1"
										onchange={(e) =>
											settingsStore.updateTheme({
												codeBlock: e.currentTarget.value
											})}
									/>
								</div>
							</div>

							<!-- Text Color -->
							<div>
								<label for="text-color" class="mb-1 block text-sm font-medium">
									{i18n.t.settings.textColor}
								</label>
								<div class="flex gap-2">
									<input
										type="color"
										id="text-color"
										value={settingsStore.current.theme?.textColor || '#333333'}
										onchange={(e) =>
											settingsStore.updateTheme({
												textColor: e.currentTarget.value
											})}
										class="border-input h-8 w-12 cursor-pointer rounded border"
									/>
									<Input
										value={settingsStore.current.theme?.textColor || '#333333'}
										class="flex-1"
										onchange={(e) =>
											settingsStore.updateTheme({
												textColor: e.currentTarget.value
											})}
									/>
								</div>
							</div>
						</div>
					</div>
				{/if}

				{#if activeTab === 'mermaid'}
					<div class="space-y-4">
						<div class="grid grid-cols-1 gap-4">
							<div>
								<h3 class="mb-3 font-medium">Mermaid Diagrams</h3>
								<p class="text-muted-foreground mb-4 text-sm">
									Configure how charts and diagrams are rendered.
								</p>

								<div class="space-y-4">
									<div>
										<label for="mermaid-font-family" class="mb-1 block text-sm font-medium"
											>{i18n.t.settings.fontFamily}</label
										>
										<select
											id="mermaid-font-family"
											class="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
											value={settingsStore.current.mermaid?.fontFamily || 'Arial, sans-serif'}
											onchange={(e) =>
												settingsStore.updateMermaid({
													fontFamily: e.currentTarget.value
												})}
										>
											<optgroup label="Bundled Fonts">
												<option value="Cairo">Cairo (Arabic)</option>
											</optgroup>
											<optgroup label="System Fonts - Arabic">
												<option value="Helvetica Neue LT Arabic">Helvetica Neue LT Arabic</option>
												<option value="SF Arabic">SF Arabic (macOS)</option>
												<option value="Segoe UI">Segoe UI (Windows)</option>
												<option value="Tahoma">Tahoma</option>
											</optgroup>
											<optgroup label="System Fonts - General">
												<option value="Arial, sans-serif">Arial</option>
												<option value="Helvetica Neue">Helvetica Neue</option>
												<option value="Georgia">Georgia</option>
												<option value="Times New Roman">Times New Roman</option>
												<option value="Verdana">Verdana</option>
												<option value="system-ui">System Default</option>
												<option value="'Courier New', Courier, monospace">Courier New</option>
												<option value="'Fira Code', monospace">Fira Code</option>
											</optgroup>
										</select>
									</div>

									<div>
										<label for="mermaid-font-size" class="mb-1 block text-sm font-medium"
											>{i18n.t.settings.fontSize} (px)</label
										>
										<Input
											id="mermaid-font-size"
											type="number"
											min="8"
											max="32"
											value={settingsStore.current.mermaid?.fontSize?.toString() || '14'}
											onchange={(e) =>
												settingsStore.updateMermaid({
													fontSize: parseInt(e.currentTarget.value) || 14
												})}
										/>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="border-border flex items-center justify-between border-t p-4">
				<Button variant="outline" onclick={resetSettings}>
					{i18n.t.settings.reset}
				</Button>
				<Button onclick={onclose}>
					{i18n.t.settings.close}
				</Button>
			</div>
		</div>
	</div>
{/if}
