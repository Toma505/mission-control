'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Play,
  Save,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  GripVertical,
  X,
  ChevronRight,
  Copy,
  Undo2,
} from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import {
  type Workflow,
  type WorkflowNode,
  type WorkflowEdge,
  type NodeDefinition,
  type NodeType,
  NODE_CATALOG,
  NODE_TYPE_COLORS,
  NODE_TYPE_LABELS,
} from '@/lib/workflow-types'

// ─── Constants ──────────────────────────────────────────

const NODE_WIDTH = 200
const NODE_HEIGHT_BASE = 60
const PORT_RADIUS = 6
const GRID_SIZE = 20

// ─── Sub-components ─────────────────────────────────────

function NodePalette({
  onDragStart,
  collapsed,
  onToggle,
}: {
  onDragStart: (def: NodeDefinition, e: React.DragEvent) => void
  collapsed: boolean
  onToggle: () => void
}) {
  const [filter, setFilter] = useState('')
  const grouped = NODE_CATALOG.reduce<Record<NodeType, NodeDefinition[]>>((acc, def) => {
    if (!acc[def.type]) acc[def.type] = []
    acc[def.type].push(def)
    return acc
  }, {} as Record<NodeType, NodeDefinition[]>)

  const filtered = filter
    ? Object.fromEntries(
        Object.entries(grouped).map(([type, defs]) => [
          type,
          defs.filter(
            d =>
              d.label.toLowerCase().includes(filter.toLowerCase()) ||
              d.description.toLowerCase().includes(filter.toLowerCase())
          ),
        ]).filter(([, defs]) => (defs as NodeDefinition[]).length > 0)
      )
    : grouped

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="absolute left-3 top-3 z-20 p-2 rounded-xl glass border border-[var(--glass-border)] hover:bg-white/[0.06] transition-colors"
        title="Show node palette"
      >
        <Plus className="w-4 h-4 text-text-primary" />
      </button>
    )
  }

  return (
    <div className="absolute left-3 top-3 bottom-3 w-56 z-20 glass rounded-2xl border border-[var(--glass-border)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--glass-border)]">
        <span className="text-xs font-semibold text-text-primary">Nodes</span>
        <button onClick={onToggle} className="p-1 rounded-lg hover:bg-white/[0.06]">
          <X className="w-3.5 h-3.5 text-text-muted" />
        </button>
      </div>
      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="Search nodes..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-[var(--accent-primary)]/50"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
        {(Object.entries(filtered) as [NodeType, NodeDefinition[]][]).map(([type, defs]) => (
          <div key={type}>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider px-1 mb-1"
              style={{ color: NODE_TYPE_COLORS[type] }}
            >
              {NODE_TYPE_LABELS[type]}
            </p>
            <div className="space-y-1">
              {defs.map(def => (
                <div
                  key={def.subtype}
                  draggable
                  onDragStart={e => onDragStart(def, e)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/[0.06] transition-colors group"
                >
                  <span className="text-sm shrink-0">{def.icon}</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-text-primary truncate">{def.label}</p>
                    <p className="text-[9px] text-text-muted truncate">{def.description}</p>
                  </div>
                  <GripVertical className="w-3 h-3 text-text-muted/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function PropertiesPanel({
  node,
  onUpdate,
  onClose,
  onDelete,
}: {
  node: WorkflowNode
  onUpdate: (id: string, config: Record<string, unknown>, label: string) => void
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const def = NODE_CATALOG.find(d => d.subtype === node.config._subtype) || NODE_CATALOG[0]
  const [label, setLabel] = useState(node.label)
  const [config, setConfig] = useState<Record<string, unknown>>({ ...node.config })

  useEffect(() => {
    setLabel(node.label)
    setConfig({ ...node.config })
  }, [node.id, node.label, node.config])

  function save() {
    onUpdate(node.id, config, label)
  }

  return (
    <div className="absolute right-3 top-3 bottom-3 w-72 z-20 glass rounded-2xl border border-[var(--glass-border)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm">{def.icon}</span>
          <span className="text-xs font-semibold text-text-primary">{def.label}</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.06]">
          <X className="w-3.5 h-3.5 text-text-muted" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Node label */}
        <div>
          <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Label</label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onBlur={save}
            className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary focus:outline-none focus:border-[var(--accent-primary)]/50"
          />
        </div>

        {/* Config fields */}
        {def.configFields.map(field => (
          <div key={field.key}>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
              {field.label}
              {field.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {field.type === 'select' ? (
              <select
                value={String(config[field.key] || '')}
                onChange={e => {
                  const next = { ...config, [field.key]: e.target.value }
                  setConfig(next)
                  onUpdate(node.id, next, label)
                }}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary focus:outline-none focus:border-[var(--accent-primary)]/50"
              >
                {field.options?.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : field.type === 'textarea' ? (
              <textarea
                value={String(config[field.key] || '')}
                onChange={e => setConfig({ ...config, [field.key]: e.target.value })}
                onBlur={save}
                placeholder={field.placeholder}
                rows={3}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-[var(--accent-primary)]/50 resize-none"
              />
            ) : field.type === 'boolean' ? (
              <button
                onClick={() => {
                  const next = { ...config, [field.key]: !config[field.key] }
                  setConfig(next)
                  onUpdate(node.id, next, label)
                }}
                className={`mt-1 w-10 h-5 rounded-full transition-colors ${
                  config[field.key] ? 'bg-accent-primary' : 'bg-white/[0.1]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  config[field.key] ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </button>
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={String(config[field.key] ?? '')}
                onChange={e => setConfig({ ...config, [field.key]: field.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value })}
                onBlur={save}
                placeholder={field.placeholder}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-[var(--glass-border)] text-xs text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-[var(--accent-primary)]/50"
              />
            )}
          </div>
        ))}

        {/* Node ID (read-only) */}
        <div className="pt-2 border-t border-[var(--glass-border)]">
          <p className="text-[9px] text-text-muted">ID: {node.id}</p>
          <p className="text-[9px] text-text-muted">Type: {node.type} / {String(node.config._subtype)}</p>
        </div>
      </div>

      <div className="p-3 border-t border-[var(--glass-border)]">
        <button
          onClick={() => onDelete(node.id)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-400/10 text-red-400 text-xs font-medium hover:bg-red-400/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Node
        </button>
      </div>
    </div>
  )
}

// ─── Main Canvas ────────────────────────────────────────

export function WorkflowCanvas({
  workflowId,
  onBack,
}: {
  workflowId?: string
  onBack: () => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // Workflow state
  const [nodes, setNodes] = useState<WorkflowNode[]>([])
  const [edges, setEdges] = useState<WorkflowEdge[]>([])
  const [name, setName] = useState('Untitled Workflow')
  const [description, setDescription] = useState('')
  const [workflowDbId, setWorkflowDbId] = useState(workflowId || '')

  // UI state
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [paletteCollapsed, setPaletteCollapsed] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drag state
  const [dragging, setDragging] = useState<{ nodeId: string; offsetX: number; offsetY: number } | null>(null)
  const [connecting, setConnecting] = useState<{ nodeId: string; portId: string; startX: number; startY: number; mouseX: number; mouseY: number } | null>(null)

  // Load existing workflow
  useEffect(() => {
    if (workflowId) loadWorkflow(workflowId)
    return () => {
      if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
    }
  }, [workflowId])

  function showStatus(type: 'success' | 'error', msg: string) {
    setStatus({ type, msg })
    if (statusTimeoutRef.current) clearTimeout(statusTimeoutRef.current)
    statusTimeoutRef.current = setTimeout(() => setStatus(null), 3000)
  }

  /** Convert backend node format (inputs: string[]) to frontend (inputs: NodePort[]) */
  function hydrateNode(raw: Record<string, unknown>): WorkflowNode {
    const node = raw as unknown as WorkflowNode
    // Backend stores inputs/outputs as string[] — convert to NodePort[]
    if (Array.isArray(node.inputs) && node.inputs.length > 0 && typeof node.inputs[0] === 'string') {
      node.inputs = (node.inputs as unknown as string[]).map(id => ({
        id: id.includes('-') ? id : `${node.id}-${id}`,
        label: id.replace(/^.*-/, ''),
        type: 'input' as const,
      }))
    }
    if (Array.isArray(node.outputs) && node.outputs.length > 0 && typeof node.outputs[0] === 'string') {
      node.outputs = (node.outputs as unknown as string[]).map(id => ({
        id: id.includes('-') ? id : `${node.id}-${id}`,
        label: id.replace(/^.*-/, ''),
        type: 'output' as const,
      }))
    }
    // Ensure ports have full IDs
    if (Array.isArray(node.inputs)) {
      node.inputs = node.inputs.map(p => ({
        ...p,
        id: p.id.startsWith(node.id) ? p.id : `${node.id}-${p.id}`,
      }))
    }
    if (Array.isArray(node.outputs)) {
      node.outputs = node.outputs.map(p => ({
        ...p,
        id: p.id.startsWith(node.id) ? p.id : `${node.id}-${p.id}`,
      }))
    }
    return node
  }

  /** Convert frontend node format to backend (inputs: string[]) */
  function dehydrateNode(node: WorkflowNode): Record<string, unknown> {
    return {
      ...node,
      inputs: node.inputs.map(p => p.id),
      outputs: node.outputs.map(p => p.id),
    }
  }

  async function loadWorkflow(id: string) {
    try {
      const res = await fetch(`/api/workflows?id=${id}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.workflow) {
        const rawNodes = (data.workflow.nodes || []) as Record<string, unknown>[]
        setNodes(rawNodes.map(hydrateNode))
        setEdges(data.workflow.edges || [])
        setName(data.workflow.name || 'Untitled')
        setDescription(data.workflow.description || '')
        setWorkflowDbId(data.workflow.id)
      }
    } catch { /* ignore */ }
  }

  async function saveWorkflow() {
    setSaving(true)
    try {
      const workflow = { name, description, nodes: nodes.map(dehydrateNode), edges }
      const action = workflowDbId ? 'update' : 'create'
      const body: Record<string, unknown> = { action, workflow }
      if (workflowDbId) body.workflowId = workflowDbId

      const res = await apiFetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.ok) {
        if (data.workflow?.id) setWorkflowDbId(data.workflow.id)
        showStatus('success', 'Workflow saved')
      } else {
        showStatus('error', data.error || 'Save failed')
      }
    } catch {
      showStatus('error', 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function executeWorkflow() {
    if (!workflowDbId) {
      showStatus('error', 'Save the workflow first')
      return
    }
    setExecuting(true)
    try {
      const res = await apiFetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', workflowId: workflowDbId }),
      })
      const data = await res.json()
      if (data.ok) {
        showStatus('success', `Workflow executed — ${data.result?.status || 'done'}`)
      } else {
        showStatus('error', data.error || 'Execution failed')
      }
    } catch {
      showStatus('error', 'Execution failed')
    } finally {
      setExecuting(false)
    }
  }

  // ─── Node operations ────────────────────────────────

  function addNode(def: NodeDefinition, x: number, y: number) {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE
    const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE

    const node: WorkflowNode = {
      id,
      type: def.type,
      label: def.label,
      position: { x: snappedX, y: snappedY },
      config: { _subtype: def.subtype, ...def.defaultConfig },
      inputs: def.defaultInputs.map(p => ({ ...p, id: `${id}-${p.id}` })),
      outputs: def.defaultOutputs.map(p => ({ ...p, id: `${id}-${p.id}` })),
    }
    setNodes(prev => [...prev, node])
    setSelectedNode(id)
  }

  function updateNode(id: string, config: Record<string, unknown>, label: string) {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, config, label } : n))
  }

  function deleteNode(id: string) {
    setNodes(prev => prev.filter(n => n.id !== id))
    setEdges(prev => prev.filter(e => e.source !== id && e.target !== id))
    if (selectedNode === id) setSelectedNode(null)
  }

  function addEdge(sourceNode: string, sourcePort: string, targetNode: string, targetPort: string) {
    if (sourceNode === targetNode) return
    // Don't allow duplicate edges
    const exists = edges.some(e =>
      e.source === sourceNode && e.sourcePort === sourcePort &&
      e.target === targetNode && e.targetPort === targetPort
    )
    if (exists) return

    const edge: WorkflowEdge = {
      id: `edge-${Date.now()}`,
      source: sourceNode,
      sourcePort,
      target: targetNode,
      targetPort,
    }
    setEdges(prev => [...prev, edge])
  }

  // ─── Drag & drop from palette ───────────────────────

  function handlePaletteDragStart(def: NodeDefinition, e: React.DragEvent) {
    e.dataTransfer.setData('application/workflow-node', JSON.stringify(def))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function handleCanvasDrop(e: React.DragEvent) {
    e.preventDefault()
    const data = e.dataTransfer.getData('application/workflow-node')
    if (!data) return
    const def = JSON.parse(data) as NodeDefinition
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left - pan.x) / zoom
    const y = (e.clientY - rect.top - pan.y) / zoom
    addNode(def, x, y)
  }

  function handleCanvasDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  // ─── Node dragging ──────────────────────────────────

  function handleNodeMouseDown(nodeId: string, e: React.MouseEvent) {
    if (e.button !== 0) return
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = (e.clientX - rect.left - pan.x) / zoom
    const mouseY = (e.clientY - rect.top - pan.y) / zoom
    setDragging({
      nodeId,
      offsetX: mouseX - node.position.x,
      offsetY: mouseY - node.position.y,
    })
    setSelectedNode(nodeId)
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const mouseX = (e.clientX - rect.left - pan.x) / zoom
      const mouseY = (e.clientY - rect.top - pan.y) / zoom
      const x = Math.round((mouseX - dragging.offsetX) / GRID_SIZE) * GRID_SIZE
      const y = Math.round((mouseY - dragging.offsetY) / GRID_SIZE) * GRID_SIZE
      setNodes(prev => prev.map(n =>
        n.id === dragging.nodeId ? { ...n, position: { x, y } } : n
      ))
    }
    if (connecting) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      setConnecting(prev => prev ? {
        ...prev,
        mouseX: (e.clientX - rect.left - pan.x) / zoom,
        mouseY: (e.clientY - rect.top - pan.y) / zoom,
      } : null)
    }
  }, [dragging, connecting, pan, zoom])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (connecting) {
      // Check if we're over an input port
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const portEl = target?.closest('[data-port-id]') as HTMLElement | null
      if (portEl && portEl.dataset.portType === 'input') {
        const targetNodeId = portEl.dataset.nodeId || ''
        const targetPortId = portEl.dataset.portId || ''
        addEdge(connecting.nodeId, connecting.portId, targetNodeId, targetPortId)
      }
    }
    setDragging(null)
    setConnecting(null)
  }, [connecting, edges])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // ─── Port position helpers ──────────────────────────

  function getPortPosition(node: WorkflowNode, portId: string, portType: 'input' | 'output'): { x: number; y: number } {
    const ports = portType === 'input' ? node.inputs : node.outputs
    const idx = ports.findIndex(p => p.id === portId)
    const total = ports.length
    const spacing = NODE_WIDTH / (total + 1)
    const x = node.position.x + spacing * (idx + 1)
    const y = portType === 'input' ? node.position.y : node.position.y + NODE_HEIGHT_BASE
    return { x, y }
  }

  function handlePortMouseDown(nodeId: string, portId: string, portType: 'input' | 'output', e: React.MouseEvent) {
    if (portType !== 'output') return
    e.stopPropagation()
    const node = nodes.find(n => n.id === nodeId)
    if (!node) return
    const pos = getPortPosition(node, portId, 'output')
    setConnecting({
      nodeId,
      portId,
      startX: pos.x,
      startY: pos.y,
      mouseX: pos.x,
      mouseY: pos.y,
    })
  }

  // ─── Zoom controls ─────────────────────────────────

  function zoomIn() { setZoom(z => Math.min(z + 0.15, 2)) }
  function zoomOut() { setZoom(z => Math.max(z - 0.15, 0.3)) }
  function fitView() { setZoom(1); setPan({ x: 0, y: 0 }) }

  // ─── Canvas click (deselect) ───────────────────────

  function handleCanvasClick(e: React.MouseEvent) {
    if (e.target === canvasRef.current || e.target === svgRef.current) {
      setSelectedNode(null)
    }
  }

  // ─── Edge path builder ─────────────────────────────

  function buildEdgePath(sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }): string {
    const dy = targetPos.y - sourcePos.y
    const controlOffset = Math.max(40, Math.abs(dy) * 0.5)
    return `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x} ${sourcePos.y + controlOffset}, ${targetPos.x} ${targetPos.y - controlOffset}, ${targetPos.x} ${targetPos.y}`
  }

  // ─── Keyboard shortcuts ────────────────────────────

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNode && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
          deleteNode(selectedNode)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveWorkflow()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selectedNode, nodes, edges, name, description])

  // ─── Render ────────────────────────────────────────

  const selectedNodeData = nodes.find(n => n.id === selectedNode) || null

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Back to workflows"
          >
            <ChevronRight className="w-4 h-4 text-text-muted rotate-180" />
          </button>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="text-sm font-semibold text-text-primary bg-transparent border-none focus:outline-none focus:ring-0 w-48"
            placeholder="Workflow name"
          />
        </div>

        <div className="flex items-center gap-2">
          {status && (
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-lg ${
              status.type === 'success' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
            }`}>
              {status.msg}
            </span>
          )}

          <div className="flex items-center gap-1 mr-2">
            <button onClick={zoomOut} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted" title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-text-muted w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted" title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={fitView} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-text-muted" title="Fit view">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass border border-[var(--glass-border)] text-xs font-medium text-text-primary hover:bg-white/[0.06] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save
          </button>
          <button
            onClick={executeWorkflow}
            disabled={executing || nodes.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary text-white text-xs font-medium hover:bg-accent-primary/80 transition-colors disabled:opacity-50"
          >
            {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden bg-[var(--background-main)]">
        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
            backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* Node palette */}
        <NodePalette
          onDragStart={handlePaletteDragStart}
          collapsed={paletteCollapsed}
          onToggle={() => setPaletteCollapsed(!paletteCollapsed)}
        />

        {/* Properties panel */}
        {selectedNodeData && (
          <PropertiesPanel
            node={selectedNodeData}
            onUpdate={updateNode}
            onClose={() => setSelectedNode(null)}
            onDelete={deleteNode}
          />
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="absolute inset-0"
          onClick={handleCanvasClick}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* SVG layer for edges */}
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              {/* Existing edges */}
              {edges.map(edge => {
                const sourceNode = nodes.find(n => n.id === edge.source)
                const targetNode = nodes.find(n => n.id === edge.target)
                if (!sourceNode || !targetNode) return null
                const sourcePos = getPortPosition(sourceNode, edge.sourcePort, 'output')
                const targetPos = getPortPosition(targetNode, edge.targetPort, 'input')
                const color = NODE_TYPE_COLORS[sourceNode.type]
                return (
                  <g key={edge.id}>
                    <path
                      d={buildEdgePath(sourcePos, targetPos)}
                      stroke={color}
                      strokeWidth={2}
                      fill="none"
                      strokeOpacity={0.5}
                    />
                    {/* Clickable wider path for deletion */}
                    <path
                      d={buildEdgePath(sourcePos, targetPos)}
                      stroke="transparent"
                      strokeWidth={12}
                      fill="none"
                      className="cursor-pointer pointer-events-auto"
                      onClick={() => setEdges(prev => prev.filter(e => e.id !== edge.id))}
                    />
                  </g>
                )
              })}

              {/* In-progress connection line */}
              {connecting && (
                <path
                  d={buildEdgePath(
                    { x: connecting.startX, y: connecting.startY },
                    { x: connecting.mouseX, y: connecting.mouseY }
                  )}
                  stroke="var(--accent-primary)"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray="6,4"
                  strokeOpacity={0.6}
                />
              )}
            </svg>

            {/* Node elements */}
            {nodes.map(node => {
              const color = NODE_TYPE_COLORS[node.type]
              const isSelected = node.id === selectedNode
              return (
                <div
                  key={node.id}
                  className={`absolute group cursor-move select-none`}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    width: NODE_WIDTH,
                  }}
                  onMouseDown={e => handleNodeMouseDown(node.id, e)}
                >
                  {/* Node body */}
                  <div
                    className={`rounded-xl border transition-all ${
                      isSelected
                        ? 'shadow-lg ring-1'
                        : 'hover:shadow-md'
                    }`}
                    style={{
                      background: 'var(--glass-bg)',
                      borderColor: isSelected ? color : 'var(--glass-border)',
                      boxShadow: isSelected ? `0 0 20px ${color}20` : undefined,
                      ['--tw-ring-color' as string]: color,
                    }}
                  >
                    {/* Header bar */}
                    <div
                      className="h-1 rounded-t-xl"
                      style={{ background: color }}
                    />

                    <div className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {NODE_CATALOG.find(d => d.subtype === node.config._subtype)?.icon || '⬡'}
                        </span>
                        <span className="text-[11px] font-semibold text-text-primary truncate">
                          {node.label}
                        </span>
                      </div>
                      <p className="text-[9px] text-text-muted mt-0.5 truncate">
                        {NODE_CATALOG.find(d => d.subtype === node.config._subtype)?.description || node.type}
                      </p>
                    </div>

                    {/* Input ports (top) */}
                    <div className="absolute -top-[6px] left-0 right-0 flex justify-around px-4">
                      {node.inputs.map(port => (
                        <div
                          key={port.id}
                          data-port-id={port.id}
                          data-port-type="input"
                          data-node-id={node.id}
                          className="relative group/port"
                        >
                          <div
                            className="w-3 h-3 rounded-full border-2 bg-[var(--background-main)] hover:scale-125 transition-transform cursor-crosshair"
                            style={{ borderColor: color }}
                          />
                          <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[8px] text-text-muted whitespace-nowrap opacity-0 group-hover/port:opacity-100 transition-opacity">
                            {port.label}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Output ports (bottom) */}
                    <div className="absolute -bottom-[6px] left-0 right-0 flex justify-around px-4">
                      {node.outputs.map(port => (
                        <div
                          key={port.id}
                          data-port-id={port.id}
                          data-port-type="output"
                          data-node-id={node.id}
                          className="relative group/port"
                          onMouseDown={e => handlePortMouseDown(node.id, port.id, 'output', e)}
                        >
                          <div
                            className="w-3 h-3 rounded-full border-2 bg-[var(--background-main)] hover:scale-125 transition-transform cursor-crosshair"
                            style={{ borderColor: color }}
                          />
                          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[8px] text-text-muted whitespace-nowrap opacity-0 group-hover/port:opacity-100 transition-opacity">
                            {port.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-3 max-w-xs">
                <div className="w-16 h-16 rounded-2xl bg-accent-primary/10 flex items-center justify-center mx-auto">
                  <Plus className="w-8 h-8 text-accent-primary" />
                </div>
                <p className="text-sm font-medium text-text-secondary">Drag nodes from the palette to start building</p>
                <p className="text-xs text-text-muted">
                  Connect outputs to inputs to create your agent workflow. Start with a trigger, add agents and actions, then wire them together.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
