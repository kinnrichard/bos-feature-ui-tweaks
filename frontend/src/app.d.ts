// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			message: string;
			status?: number;
		}
		interface Locals {
			user?: {
				id: string;
				email: string;
				name: string;
				role: string;
			};
		}
		interface PageData {
			user?: {
				id: string;
				email: string;
				name: string;
				role: string;
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
