export function getOrCreateInstallId(): string {
    return 'company-fork-local';
}

export async function sendAnonymousInstallPing(): Promise<void> {}

export const InstallPingManager = {
    getOrCreateInstallId,
    sendAnonymousInstallPing,
};
