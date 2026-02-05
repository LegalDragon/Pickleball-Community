import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { tournamentApi } from '../services/api'
import {
  Layers, Plus, Edit2, Trash2, X, RefreshCw, AlertTriangle, Copy,
  Code, Save, GitBranch, Trophy, Users, Hash, Tag, FileJson,
  Info, LayoutList, Lightbulb, ArrowLeft, Search, Settings, Grid3X3, List
} from 'lucide-react'

// Import shared constants, helpers, and the reusable editor
import {
  CATEGORIES,
  parseStructureToVisual, serializeVisualToJson
} from '../components/tournament/structureEditorConstants'
import ListPhaseEditor from '../components/tournament/ListPhaseEditor'
import { CanvasPhaseEditor } from './PhaseTemplatesAdmin'

const DEFAULT_STRUCTURE = JSON.stringify({ phases:[{ name:'Main Bracket', phaseType:'SingleElimination',
  sortOrder:1, incomingSlotCount:8, advancingSlotCount:1, poolCount:0, bestOf:1, matchDurationMinutes:30 }], advancementRules:[] }, null, 2)
const EMPTY_FORM = { name:'', description:'', category:'SingleElimination', minUnits:4, maxUnits:16, defaultUnits:8, diagramText:'', tags:'', structureJson:DEFAULT_STRUCTURE }


// ══════════════════════════════════════════
// DuplicateFromSystemModal
// ══════════════════════════════════════════
const DuplicateFromSystemModal = ({ onSelect, onClose }) => {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')

  useEffect(() => {
    tournamentApi.getPhaseTemplates().then(res => {
      setTemplates((Array.isArray(res)?res:(res.data||[])).filter(t=>t.isSystemTemplate&&t.isActive))
    }).catch(()=>setTemplates([])).finally(()=>setLoading(false))
  }, [])

  const filtered = templates.filter(t => (cat==='all'||t.category===cat) && (!search||t.name.toLowerCase().includes(search.toLowerCase())))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Duplicate System Template</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
        </div>
        <div className="px-6 py-3 border-b flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
            <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500"/>
          </div>
          <select value={cat} onChange={e=>setCat(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading?<div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-purple-500"/></div>
          :filtered.length===0?<p className="text-center text-gray-500 py-8">No system templates found.</p>
          :<div className="space-y-2">{filtered.map(t=>(
            <button key={t.id} onClick={()=>onSelect(t)} className="w-full text-left p-3 border rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors">
              <div className="flex items-center justify-between">
                <div><div className="font-medium text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.category} · {t.minUnits}–{t.maxUnits} teams{t.description?` · ${t.description.slice(0,60)}${t.description.length>60?'...':''}`:''}</div>
                </div><Copy className="w-4 h-4 text-purple-500 flex-shrink-0"/>
              </div>
            </button>))}</div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════
// MyTemplates — Main page
// ══════════════════════════════════════════
const MyTemplates = () => {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null) // null | 'new' | template
  const [editorMode, setEditorMode] = useState('visual')
  const [visualSubMode, setVisualSubMode] = useState('canvas') // 'canvas' | 'list'
  const [visualState, setVisualState] = useState(null)
  const [formData, setFormData] = useState({...EMPTY_FORM})
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadTemplates = async () => {
    setLoading(true); setError(null)
    try { const r=await tournamentApi.getMyPhaseTemplates(); setTemplates(Array.isArray(r)?r:(r?.data||[])) }
    catch(e){ setError(e.message||'Failed to load templates') } finally{ setLoading(false) }
  }
  useEffect(()=>{loadTemplates()},[])

  const filteredTemplates = categoryFilter==='all'?templates:templates.filter(t=>t.category===categoryFilter)

  const openEditor = (fd, tpl=null) => { setFormData(fd); setVisualState(parseStructureToVisual(fd.structureJson)); setEditorMode('visual'); setEditing(tpl||'new') }
  const handleCreate = () => openEditor({...EMPTY_FORM})
  const templateToForm = (t) => { const s=typeof t.structureJson==='string'?t.structureJson:JSON.stringify(t.structureJson,null,2)
    return { name:t.name, description:t.description||'', category:t.category, minUnits:t.minUnits, maxUnits:t.maxUnits, defaultUnits:t.defaultUnits, diagramText:t.diagramText||'', tags:t.tags||'', structureJson:s } }
  const handleEdit = (t) => openEditor(templateToForm(t), t)
  const handleDuplicate = (t) => openEditor({...templateToForm(t), name:`${t.name} (Copy)`})

  const handleVisualChange = useCallback((newVs) => { setVisualState(newVs); setFormData(p=>({...p,structureJson:serializeVisualToJson(newVs)})) }, [])
  const handleToggleMode = () => { if(editorMode==='visual'){setEditorMode('json')} else {setVisualState(parseStructureToVisual(formData.structureJson));setEditorMode('visual')} }

  const handleSave = async () => {
    try{JSON.parse(formData.structureJson)}catch{alert('Invalid JSON. Fix syntax first.');return}
    if(!formData.name.trim()){alert('Name is required');return}
    setSaving(true)
    try {
      const payload = { name:formData.name.trim(), description:formData.description.trim(), category:formData.category,
        minUnits:parseInt(formData.minUnits), maxUnits:parseInt(formData.maxUnits), defaultUnits:parseInt(formData.defaultUnits),
        diagramText:formData.diagramText.trim(), tags:formData.tags.trim(), structureJson:formData.structureJson, isSystemTemplate:false }
      if(editing&&editing!=='new'&&editing.id) await tournamentApi.updatePhaseTemplate(editing.id,payload)
      else await tournamentApi.createPhaseTemplate(payload)
      setEditing(null); loadTemplates()
    } catch(e){ alert(e.message||'Failed to save') } finally{ setSaving(false) }
  }

  const handleDelete = async (t) => { try{await tournamentApi.deletePhaseTemplate(t.id);setDeleteConfirm(null);loadTemplates()}catch(e){alert(e.message||'Failed to delete')} }

  const sf = (f,v) => setFormData(p=>({...p,[f]:v}))
  const fi = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"

  // ═══ Editor View ═══
  if (editing) return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <button onClick={()=>setEditing(null)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5"/><span className="font-medium">Back</span></button>
          <div className="flex items-center gap-2">
            <button onClick={handleToggleMode} className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
              {editorMode==='visual'?<Code className="w-4 h-4"/>:<LayoutList className="w-4 h-4"/>}{editorMode==='visual'?'JSON':'Visual'}</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {saving?<RefreshCw className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{saving?'Saving...':'Save'}</button>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{editing==='new'?'Create New Template':`Edit: ${formData.name||'Template'}`}</h1>

        {/* Metadata */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><Info className="w-5 h-5 text-purple-600"/>Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name} onChange={e=>sf('name',e.target.value)} placeholder="e.g. 8-Team Single Elimination" className={fi}/></div>
            <div className="sm:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={formData.description} onChange={e=>sf('description',e.target.value)} rows={2} placeholder="Brief description..." className={fi}/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={formData.category} onChange={e=>sf('category',e.target.value)} className={fi}>
                {CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
                <input type="number" min={2} value={formData.minUnits} onChange={e=>sf('minUnits',parseInt(e.target.value)||2)} className={fi}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Max</label>
                <input type="number" min={2} value={formData.maxUnits} onChange={e=>sf('maxUnits',parseInt(e.target.value)||2)} className={fi}/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Default</label>
                <input type="number" min={2} value={formData.defaultUnits} onChange={e=>sf('defaultUnits',parseInt(e.target.value)||2)} className={fi}/></div>
            </div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input type="text" value={formData.tags} onChange={e=>sf('tags',e.target.value)} placeholder="beginner, quick" className={fi}/></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Diagram Text</label>
              <input type="text" value={formData.diagramText} onChange={e=>sf('diagramText',e.target.value)} placeholder="Short diagram label" className={fi}/></div>
          </div>
        </div>

        {/* Structure */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Layers className="w-5 h-5 text-purple-600"/>Structure</h2>
            {editorMode==='visual'&&(
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                <button onClick={()=>setVisualSubMode('canvas')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${visualSubMode==='canvas'?'bg-white shadow text-purple-700':'text-gray-600 hover:text-gray-900'}`}>
                  <Grid3X3 className="w-3.5 h-3.5"/>Canvas
                </button>
                <button onClick={()=>setVisualSubMode('list')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${visualSubMode==='list'?'bg-white shadow text-purple-700':'text-gray-600 hover:text-gray-900'}`}>
                  <List className="w-3.5 h-3.5"/>List
                </button>
              </div>
            )}
          </div>
          {editorMode==='visual'&&visualState?(
            visualSubMode==='canvas'?(
              <div className="h-[500px] border rounded-lg overflow-hidden">
                <CanvasPhaseEditor visualState={visualState} onChange={handleVisualChange}/>
              </div>
            ):(
              <ListPhaseEditor visualState={visualState} onChange={handleVisualChange}/>
            )
          ):(
            <div><div className="flex items-center gap-2 mb-2"><FileJson className="w-4 h-4 text-gray-500"/><span className="text-sm text-gray-600">Raw JSON</span></div>
              <textarea value={formData.structureJson} onChange={e=>sf('structureJson',e.target.value)} rows={18}
                className="w-full px-4 py-3 border rounded-lg font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-purple-500"/></div>)}
        </div>
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0"/>
          <p className="text-sm text-amber-800"><strong>Tip:</strong> Use Visual Editor for phases and rules. Switch to JSON for fine control. Changes sync between modes.</p>
        </div>
      </div>
    </div>
  )

  // ═══ List View ═══
  return (
    <div className="min-h-screen bg-gray-50">
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div><h1 className="text-2xl font-bold text-gray-900">My Templates</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage your tournament phase templates</p></div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowDuplicateModal(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50">
              <Copy className="w-4 h-4"/>From System</button>
            <button onClick={handleCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 shadow-sm">
              <Plus className="w-4 h-4"/>New Template</button>
          </div>
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button onClick={()=>setCategoryFilter('all')} className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${categoryFilter==='all'?'bg-purple-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
          {CATEGORIES.map(c=><button key={c.value} onClick={()=>setCategoryFilter(c.value)}
            className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap ${categoryFilter===c.value?'bg-purple-600 text-white':'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c.label}</button>)}
        </div>

        {error&&<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-4 h-4"/><span className="text-sm">{error}</span>
          <button onClick={loadTemplates} className="ml-auto text-sm underline">Retry</button></div>}

        {loading?<div className="flex justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-purple-500"/></div>
        :filteredTemplates.length===0?(
          <div className="text-center py-16 bg-white rounded-xl border">
            <Layers className="w-16 h-16 text-gray-300 mx-auto mb-4"/>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">{templates.length===0?'No templates yet':'No templates in this category'}</h3>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">{templates.length===0?'Create your first template or duplicate from system templates.':'Try another category or create a new template.'}</p>
            <div className="flex items-center justify-center gap-3">
              <button onClick={()=>setShowDuplicateModal(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50"><Copy className="w-4 h-4"/>From System</button>
              <button onClick={handleCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700"><Plus className="w-4 h-4"/>Create</button>
            </div>
          </div>
        ):(
          <div className="space-y-3">{filteredTemplates.map(t=>{
            const ci=CATEGORIES.find(c=>c.value===t.category), CI=ci?.icon||Layers
            let pc=0; try{const s=typeof t.structureJson==='string'?JSON.parse(t.structureJson):t.structureJson;pc=s.isFlexible?0:(s.phases?.length||0)}catch{}
            return(
              <div key={t.id} className="bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0"><CI className="w-5 h-5 text-purple-600"/></div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{t.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{ci?.label||t.category}</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3"/>{t.minUnits}–{t.maxUnits}</span>
                        {pc>0&&<span className="text-xs text-gray-500 flex items-center gap-1"><Hash className="w-3 h-3"/>{pc} phase{pc!==1?'s':''}</span>}
                        {t.tags&&<span className="text-xs text-gray-400 flex items-center gap-1"><Tag className="w-3 h-3"/>{t.tags}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.isActive!==false?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}`}>{t.isActive!==false?'Active':'Inactive'}</span>
                      </div>
                      {t.description&&<p className="text-sm text-gray-500 mt-1 line-clamp-1">{t.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={()=>handleDuplicate(t)} title="Duplicate" className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"><Copy className="w-4 h-4"/></button>
                    <button onClick={()=>handleEdit(t)} title="Edit" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={()=>setDeleteConfirm(t)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>)})}</div>)}
      </div>

      {showDuplicateModal&&<DuplicateFromSystemModal onSelect={t=>{setShowDuplicateModal(false);handleDuplicate(t)}} onClose={()=>setShowDuplicateModal(false)}/>}

      {deleteConfirm&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600"/></div>
              <div><h3 className="font-semibold text-gray-900">Delete Template</h3><p className="text-sm text-gray-500">Cannot be undone.</p></div>
            </div>
            <p className="text-sm text-gray-700 mb-6">Delete <strong>"{deleteConfirm.name}"</strong>?</p>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={()=>handleDelete(deleteConfirm)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>)}
    </div>
  )
}

export default MyTemplates
