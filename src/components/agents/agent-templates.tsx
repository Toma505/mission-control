'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Bot,
  ChevronRight,
  Copy,
  LayoutTemplate,
  Plus,
  Rocket,
  Store,
  Trash2,
  Wand2,
  Wrench,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { AgentTemplate } from '@/lib/agent-templates-store'

type TemplatesResponse = {
  templates: AgentTemplate[]
  connected: boolean
}

export function AgentTemplates() {
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [connected, setConnected] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<AgentTemplate | null>(null)
  const [deployName, setDeployName] = useState('')

  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSystemPrompt, setFormSystemPrompt] = useState('')
  const [formRecommendedModel, setFormRecommendedModel] = useState('')
  const [formTools, setFormTools] = useState('')
  const [formPlugins, setFormPlugins] = useState('')

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch('/api/templates')
      const data = await response.json() as TemplatesResponse
      setTemplates(data.templates || [])
      setConnected(!!data.connected)
      if ((data.templates || []).length > 0) {
        setSelectedTemplateId((current) => current || data.templates[0].id)
      } else {
        setSelectedTemplateId('')
      }
      setNotice('')
    } catch {
      setNotice('Could not load templates right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null
  const builtIns = useMemo(() => templates.filter((template) => template.builtIn), [templates])
  const customTemplates = useMemo(() => templates.filter((template) => !template.builtIn), [templates])

  useEffect(() => {
    if (selectedTemplate) {
      setDeployName(selectedTemplate.name)
    }
  }, [selectedTemplate])

  function resetForm() {
    setShowForm(false)
    setEditing(null)
    setFormName('')
    setFormDescription('')
    setFormSystemPrompt('')
    setFormRecommendedModel('')
    setFormTools('')
    setFormPlugins('')
  }

  function startEdit(template?: AgentTemplate) {
    if (template) {
      setEditing(template)
      setFormName(template.name)
      setFormDescription(template.description)
      setFormSystemPrompt(template.systemPrompt)
      setFormRecommendedModel(template.recommendedModel)
      setFormTools(template.suggestedTools.join(', '))
      setFormPlugins(template.suggestedPlugins.join(', '))
    } else {
      setEditing(null)
      setFormName('')
      setFormDescription('')
      setFormSystemPrompt('')
      setFormRecommendedModel('')
      setFormTools('')
      setFormPlugins('')
    }
    setShowForm(true)
  }

  async function handleSave() {
    setBusyAction('save')
    try {
      await apiFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing?.id,
          name: formName,
          description: formDescription,
          systemPrompt: formSystemPrompt,
          recommendedModel: formRecommendedModel,
          suggestedTools: formTools.split(',').map((value) => value.trim()).filter(Boolean),
          suggestedPlugins: formPlugins.split(',').map((value) => value.trim()).filter(Boolean),
        }),
      })
      resetForm()
      await loadTemplates()
      setNotice(editing ? 'Template updated.' : 'Template created.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleClone(templateId: string) {
    setBusyAction(`clone:${templateId}`)
    try {
      await apiFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clone', templateId }),
      })
      await loadTemplates()
      setNotice('Template cloned. You can edit the copy now.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleDelete(templateId: string) {
    if (!window.confirm('Delete this custom template?')) return
    setBusyAction(`delete:${templateId}`)
    try {
      await apiFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', templateId }),
      })
      await loadTemplates()
      setNotice('Template deleted.')
    } finally {
      setBusyAction('')
    }
  }

  async function handleDeploy() {
    if (!selectedTemplate) return
    setBusyAction(`deploy:${selectedTemplate.id}`)
    try {
      const response = await apiFetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deploy',
          templateId: selectedTemplate.id,
          agentName: deployName,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setNotice(data.error || 'Template deployment failed.')
        return
      }
      setNotice(`Deployed "${selectedTemplate.name}" as agent "${data.agentName}".`)
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div className="space-y-5">
      {!connected ? (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          OpenClaw is not connected right now. You can still browse and create templates, but Deploy will stay disabled until the app is connected.
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </div>
      ) : null}

      {showForm ? (
        <div className="glass rounded-2xl border border-accent-primary/20 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-text-primary">{editing ? 'Edit Template' : 'New Template'}</h3>
              <p className="mt-1 text-xs text-text-muted">Build an agent template from scratch or tune a cloned built-in.</p>
            </div>
            <button onClick={resetForm} className="rounded-lg p-1 hover:bg-white/[0.08]">
              <X className="h-4 w-4 text-text-muted" />
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={formName}
              onChange={(event) => setFormName(event.target.value)}
              placeholder="Template name"
              className="rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
            <input
              type="text"
              value={formRecommendedModel}
              onChange={(event) => setFormRecommendedModel(event.target.value)}
              placeholder="Recommended model"
              className="rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
          </div>

          <input
            type="text"
            value={formDescription}
            onChange={(event) => setFormDescription(event.target.value)}
            placeholder="Description"
            className="mt-3 w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
          />

          <textarea
            value={formSystemPrompt}
            onChange={(event) => setFormSystemPrompt(event.target.value)}
            placeholder="System prompt"
            rows={8}
            className="mt-3 w-full rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 font-mono text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none resize-none"
          />

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <input
              type="text"
              value={formTools}
              onChange={(event) => setFormTools(event.target.value)}
              placeholder="Suggested tools (comma separated)"
              className="rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
            <input
              type="text"
              value={formPlugins}
              onChange={(event) => setFormPlugins(event.target.value)}
              placeholder="Suggested plugins (comma separated)"
              className="rounded-xl border border-[var(--glass-border)] bg-white/[0.04] px-3 py-2 text-xs text-text-primary placeholder:text-text-muted/50 focus:outline-none"
            />
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => void handleSave()}
              disabled={!formName.trim() || !formSystemPrompt.trim() || !formRecommendedModel.trim() || busyAction === 'save'}
              className="rounded-xl bg-accent-primary px-4 py-2 text-xs font-medium text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busyAction === 'save' ? 'Saving...' : editing ? 'Update Template' : 'Create Template'}
            </button>
            <button
              onClick={resetForm}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="glass rounded-2xl overflow-hidden">
          <div className="border-b border-[var(--glass-border)] px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-accent-primary" />
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Agent Templates</h2>
                  <p className="text-xs text-text-muted">Built-ins plus custom templates you can deploy into OpenClaw.</p>
                </div>
              </div>
              <button
                onClick={() => startEdit()}
                className="rounded-xl bg-accent-primary/20 px-3 py-2 text-xs font-medium text-accent-primary hover:bg-accent-primary/30 transition-colors"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                New
              </button>
            </div>
          </div>

          <div className="max-h-[75vh] overflow-y-auto px-3 py-3 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-4 text-sm text-text-muted">
                Loading templates...
              </div>
            ) : (
              <>
                <div>
                  <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted/60">Built-in</p>
                  <div className="space-y-2">
                    {builtIns.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={cn(
                          'w-full rounded-2xl border px-4 py-4 text-left transition-all',
                          selectedTemplateId === template.id
                            ? 'border-accent-primary/40 bg-accent-primary/10'
                            : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-text-primary">{template.name}</p>
                            <p className="mt-1 text-xs text-text-secondary line-clamp-2">{template.description}</p>
                          </div>
                          <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-text-muted">Built-in</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-text-muted/60">Custom</p>
                  {customTemplates.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-5 text-center text-sm text-text-muted">
                      No custom templates yet.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {customTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={cn(
                            'w-full rounded-2xl border px-4 py-4 text-left transition-all',
                            selectedTemplateId === template.id
                              ? 'border-accent-primary/40 bg-accent-primary/10'
                              : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-text-primary">{template.name}</p>
                              <p className="mt-1 text-xs text-text-secondary line-clamp-2">{template.description}</p>
                            </div>
                            <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] text-text-muted">Custom</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="glass rounded-2xl overflow-hidden">
            {selectedTemplate ? (
              <>
                <div className="border-b border-[var(--glass-border)] px-6 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-text-primary">{selectedTemplate.name}</h1>
                        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                          {selectedTemplate.builtIn ? 'Built-in' : 'Custom'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-muted">{selectedTemplate.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => void handleClone(selectedTemplate.id)}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
                      >
                        <Copy className="mr-1 inline h-3.5 w-3.5" />
                        Clone
                      </button>
                      <button
                        onClick={() => startEdit(selectedTemplate)}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-xs font-medium text-text-primary hover:bg-white/[0.07] transition-colors"
                      >
                        <Wand2 className="mr-1 inline h-3.5 w-3.5" />
                        {selectedTemplate.builtIn ? 'Customize' : 'Edit'}
                      </button>
                      {!selectedTemplate.builtIn ? (
                        <button
                          onClick={() => void handleDelete(selectedTemplate.id)}
                          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-500/15 transition-colors"
                        >
                          <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 px-6 py-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                        <Bot className="h-4 w-4" />
                        System prompt
                      </div>
                      <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-black/20 px-4 py-4 font-mono text-sm leading-6 text-text-primary/90">
                        {selectedTemplate.systemPrompt}
                      </pre>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                          <Rocket className="h-4 w-4" />
                          Recommended model
                        </div>
                        <p className="mt-4 text-sm text-text-primary">{selectedTemplate.recommendedModel}</p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                          <Wrench className="h-4 w-4" />
                          Suggested tools
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selectedTemplate.suggestedTools.length > 0 ? selectedTemplate.suggestedTools.map((tool) => (
                            <span key={tool} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-text-primary">
                              {tool}
                            </span>
                          )) : <p className="text-sm text-text-muted">No tool suggestions.</p>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                        <LayoutTemplate className="h-4 w-4" />
                        Deploy from template
                      </div>
                      <p className="mt-3 text-sm text-text-secondary">
                        This creates a new OpenClaw agent definition using the template prompt and recommended model.
                      </p>
                      <input
                        type="text"
                        value={deployName}
                        onChange={(event) => setDeployName(event.target.value)}
                        placeholder="Agent name"
                        className="mt-4 w-full rounded-xl border border-[var(--glass-border)] bg-black/20 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
                      />
                      <button
                        onClick={() => void handleDeploy()}
                        disabled={!connected || !deployName.trim() || busyAction === `deploy:${selectedTemplate.id}`}
                        className="mt-4 w-full rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Deploy
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-text-muted/70">
                        <ChevronRight className="h-4 w-4" />
                        Suggested plugins
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {selectedTemplate.suggestedPlugins.length > 0 ? selectedTemplate.suggestedPlugins.map((plugin) => (
                          <span key={plugin} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-text-primary">
                            {plugin}
                          </span>
                        )) : <p className="text-sm text-text-muted">No plugin suggestions.</p>}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="px-6 py-16 text-center">
                <LayoutTemplate className="mx-auto h-10 w-10 text-text-muted/40" />
                <p className="mt-4 text-base font-medium text-text-primary">Select a template to inspect it</p>
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-accent-primary" />
              <div>
                <h3 className="text-base font-semibold text-text-primary">Template Marketplace</h3>
                <p className="text-xs text-text-muted">Future surface for community and vendor-provided agent templates.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                'Curated templates from the Mission Control team',
                'Community packs with ratings and install counts',
                'Verified templates bundled with extension/tool requirements',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] px-4 py-5 text-sm text-text-secondary">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
