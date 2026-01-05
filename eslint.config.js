import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		}
	},
	// Handle Svelte files
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		},
		rules: {
			'svelte/no-at-html-tags': 'warn',
			'svelte/prefer-svelte-reactivity': 'warn',
			'svelte/require-each-key': 'warn',
			'svelte/no-unused-svelte-ignore': 'warn',
			'no-undef': 'off', // TypeScript handles this
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			'@typescript-eslint/no-explicit-any': 'warn'
		}
	},
	// Handle TypeScript files explicitly
	{
		files: ['**/*.ts', '**/*.svelte.ts'],
		languageOptions: {
			parser: ts.parser
		},
		rules: {
			'no-undef': 'off', // TypeScript handles this
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			'@typescript-eslint/no-explicit-any': 'warn'
		}
	},
	// Global ignores
	{
		ignores: ['build/', '.svelte-kit/', 'dist/', '.husky/']
	}
];
