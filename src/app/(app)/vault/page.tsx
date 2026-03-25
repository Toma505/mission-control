import { KeyVault } from '@/components/settings/key-vault'

export default function VaultPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">API Key Vault</h1>
        <p className="text-sm text-text-muted mt-1">
          Securely store, manage, and rotate API keys for multiple providers
        </p>
      </div>
      <KeyVault />
    </div>
  )
}
