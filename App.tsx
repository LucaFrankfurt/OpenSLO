
import React, { useState, useEffect } from 'react';
import { 
  FileJson, 
  Copy, 
  Check, 
  LayoutTemplate, 
  Activity, 
  Server, 
  Clock,
  Download,
  AlertCircle,
  Link,
  Code,
  Save,
  FolderOpen,
  Trash2,
  Box
} from 'lucide-react';
import { 
  SloState, 
  DEFAULT_SLO_STATE, 
  TEMPLATES, 
  TimeWindowUnit,
} from './types';
import { generateYaml } from './utils/yamlGenerator';

const App: React.FC = () => {
  const [sloState, setSloState] = useState<SloState>(DEFAULT_SLO_STATE);
  const [yamlOutput, setYamlOutput] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Storage State
  const [savedItems, setSavedItems] = useState<SloState[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  // Initialize from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('openslo_items');
    if (saved) {
      try {
        setSavedItems(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved items", e);
      }
    }
  }, []);

  // Validation Logic
  const validateState = (state: SloState): Record<string, string> => {
    const newErrors: Record<string, string> = {};
    const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

    // Metadata Validation
    if (!state.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (!k8sNameRegex.test(state.name)) {
      newErrors.name = 'Must be lowercase alphanumeric (kebab-case)';
    }

    if (!state.displayName.trim()) newErrors.displayName = 'Display Name is required';
    
    // SLO-only validation
    if (state.kind === 'SLO') {
      if (!state.service.trim()) newErrors.service = 'Service is required';
      
      // Objective Validation
      if (state.target === undefined || state.target === null) {
        newErrors.target = 'Target is required';
      } else if (state.target < 0 || state.target > 1) {
        newErrors.target = 'Must be between 0.0 and 1.0';
      }

      if (!state.timeWindowCount || state.timeWindowCount <= 0 || !Number.isInteger(state.timeWindowCount)) {
        newErrors.timeWindowCount = 'Must be a positive integer';
      }

      // Indicator Reference Validation
      if (state.indicatorMode === 'reference') {
        if (!state.indicatorRef?.trim()) {
          newErrors.indicatorRef = 'SLI Reference name is required';
        }
      }
    }

    // Metric Validation (Only for SLI OR SLO Inline)
    const validateMetrics = state.kind === 'SLI' || (state.kind === 'SLO' && state.indicatorMode === 'inline');

    if (validateMetrics) {
      if (state.indicatorType === 'threshold') {
        if (!state.thresholdMetric?.source.query.trim()) {
          newErrors.thresholdQuery = 'Query is required';
        }
        if (state.thresholdMetric?.value === undefined || state.thresholdMetric?.value === null) {
          newErrors.thresholdValue = 'Threshold value is required';
        }
      } else if (state.indicatorType === 'ratio') {
        if (!state.ratioMetric?.total.query.trim()) {
          newErrors.ratioTotal = 'Total query is required';
        }
        const hasGood = !!state.ratioMetric?.good?.query.trim();
        const hasBad = !!state.ratioMetric?.bad?.query.trim();
        
        if (!hasGood && !hasBad) {
          newErrors.ratioGoodBad = 'Either Good or Bad metric query is required';
        }
      }
    }

    return newErrors;
  };

  // Update YAML and Validate whenever state changes
  useEffect(() => {
    setErrors(validateState(sloState));
    setYamlOutput(generateYaml(sloState));
  }, [sloState]);

  const isValid = Object.keys(errors).length === 0;

  const loadTemplate = (templateKey: string) => {
    const template = TEMPLATES[templateKey];
    if (template) {
      setSloState(prev => ({ ...prev, ...template, id: '' })); // Reset ID for templates
    }
  };

  // Save/Load Logic
  const saveToLibrary = () => {
    if (!isValid) {
      alert("Please fix validation errors before saving.");
      return;
    }

    const idToUse = sloState.id || crypto.randomUUID();
    const itemToSave = { ...sloState, id: idToUse };
    
    // Update local state to reflect the new ID if it was missing
    setSloState(itemToSave);

    const newSavedItems = [...savedItems];
    const index = newSavedItems.findIndex(i => i.id === idToUse);
    
    if (index >= 0) {
      newSavedItems[index] = itemToSave;
    } else {
      newSavedItems.push(itemToSave);
    }
    
    setSavedItems(newSavedItems);
    localStorage.setItem('openslo_items', JSON.stringify(newSavedItems));
    
    // Quick flash or toast could go here
    const btn = document.getElementById('save-btn');
    if(btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = `<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Saved`;
      setTimeout(() => btn.innerHTML = originalText, 1500);
    }
  };

  const loadFromLibrary = (item: SloState) => {
    setSloState(item);
    setShowLibrary(false);
  };

  const deleteFromLibrary = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this item?')) {
      const newSavedItems = savedItems.filter(i => i.id !== id);
      setSavedItems(newSavedItems);
      localStorage.setItem('openslo_items', JSON.stringify(newSavedItems));
      
      // If current item is deleted, reset ID so we don't try to update it later
      if (sloState.id === id) {
        setSloState(prev => ({ ...prev, id: '' }));
      }
    }
  };

  const copyToClipboard = () => {
    if (!isValid) return;
    navigator.clipboard.writeText(yamlOutput);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const downloadYaml = () => {
    if (!isValid) return;
    const blob = new Blob([yamlOutput], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sloState.name || 'config'}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper for input classes
  const getInputClass = (errorKey?: string) => 
    `w-full bg-slate-900 border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none transition-colors ${
      errorKey && errors[errorKey] ? 'border-red-500 focus:border-red-500' : 'border-slate-600 focus:border-brand-500'
    }`;

  // Helper for error message
  const ErrorMsg = ({ msg }: { msg?: string }) => {
    if (!msg) return null;
    return (
      <p className="text-red-400 text-xs flex items-center gap-1 mt-1 animate-fadeIn">
        <AlertCircle className="h-3 w-3" /> {msg}
      </p>
    );
  };

  const handleIndicatorTypeChange = (type: 'threshold' | 'ratio') => {
    setSloState(prev => {
      // Initialize defaults if missing when switching
      if (type === 'threshold' && !prev.thresholdMetric) {
        return {
          ...prev,
          indicatorType: type,
          thresholdMetric: {
            source: { type: 'prometheus', query: '' },
            operator: 'lte',
            value: 0.5
          }
        };
      }
      if (type === 'ratio' && !prev.ratioMetric) {
        return {
          ...prev,
          indicatorType: type,
          ratioMetric: {
            total: { type: 'prometheus', query: '' },
            good: { type: 'prometheus', query: '' }
          }
        };
      }
      return { ...prev, indicatorType: type };
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-brand-500 selection:text-white pb-20">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-500 p-1.5 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.5)]">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              OpenSLO Studio
            </span>
          </div>
          <div className="flex items-center gap-3">
             <button
                onClick={() => setShowLibrary(!showLibrary)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${showLibrary ? 'bg-brand-900/30 border-brand-500 text-brand-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
             >
                <FolderOpen className="h-4 w-4" />
                Library
             </button>
             <a href="https://openslo.com/" target="_blank" rel="noreferrer" className="text-sm text-slate-400 hover:text-brand-400 transition-colors">
               Spec v1.0
             </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Saved Items "Drawer" / Area */}
        {showLibrary && (
           <section className="mb-8 animate-fadeIn">
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-xl">
                 <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-brand-400" />
                    Saved Configurations
                 </h3>
                 {savedItems.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 border border-dashed border-slate-700 rounded-xl bg-slate-900/50">
                       <p>No saved items yet.</p>
                       <p className="text-sm mt-1">Create an SLO/SLI and click Save to add it here.</p>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {savedItems.map((item) => (
                          <div 
                             key={item.id} 
                             onClick={() => loadFromLibrary(item)}
                             className="group relative bg-slate-900 border border-slate-700 hover:border-brand-500/50 hover:bg-slate-900/80 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg"
                          >
                             <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${item.kind === 'SLO' ? 'bg-brand-900/30 text-brand-300 border-brand-800' : 'bg-purple-900/30 text-purple-300 border-purple-800'}`}>
                                   {item.kind}
                                </span>
                                <button 
                                   onClick={(e) => deleteFromLibrary(item.id, e)}
                                   className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition-colors"
                                >
                                   <Trash2 className="h-3 w-3" />
                                </button>
                             </div>
                             <h4 className="font-medium text-slate-200 truncate pr-4">{item.displayName || item.name}</h4>
                             <p className="text-xs text-slate-500 truncate mt-1">{item.name}</p>
                             {item.description && (
                                <p className="text-xs text-slate-600 line-clamp-2 mt-2">{item.description}</p>
                             )}
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Editor Column */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Toolbar: Template & Actions */}
            <div className="flex justify-between items-center gap-4">
               <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
               {Object.entries(TEMPLATES).map(([key, tpl]) => (
                  <button
                     key={key}
                     onClick={() => loadTemplate(key)}
                     className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full text-xs font-medium text-slate-300 transition-colors whitespace-nowrap"
                  >
                     <LayoutTemplate className="h-3 w-3" />
                     {tpl.displayName}
                  </button>
               ))}
               </div>
               
               <div className="flex gap-2 pb-2">
                  <button
                     id="save-btn"
                     onClick={saveToLibrary}
                     disabled={!isValid}
                     className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                     <Save className="h-4 w-4" />
                     Save
                  </button>
               </div>
            </div>

            {/* Main Form */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <FileJson className="h-5 w-5 text-slate-400" />
                    Editor
                  </h3>
                  {/* Kind Switcher */}
                  <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                    <button
                      onClick={() => setSloState(prev => ({ ...prev, kind: 'SLO' }))}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        sloState.kind === 'SLO' 
                          ? 'bg-brand-600 text-white shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      SLO
                    </button>
                    <button
                      onClick={() => setSloState(prev => ({ ...prev, kind: 'SLI' }))}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        sloState.kind === 'SLI' 
                          ? 'bg-purple-600 text-white shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      SLI
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sloState.id && (
                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-700/50">
                      ID: {sloState.id.slice(0, 8)}...
                    </span>
                  )}
                  <span className="px-3 py-1 bg-slate-900 rounded-full text-xs font-mono text-slate-400">
                    {sloState.apiVersion}
                  </span>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                
                {/* General Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Name</label>
                    <input 
                      type="text" 
                      value={sloState.name}
                      onChange={(e) => setSloState({...sloState, name: e.target.value})}
                      className={getInputClass('name')}
                      placeholder={sloState.kind === 'SLO' ? "e.g. my-service-slo" : "e.g. my-service-sli"}
                    />
                    <ErrorMsg msg={errors.name} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Display Name</label>
                    <input 
                      type="text" 
                      value={sloState.displayName}
                      onChange={(e) => setSloState({...sloState, displayName: e.target.value})}
                      className={getInputClass('displayName')}
                      placeholder={sloState.kind === 'SLO' ? "My Service SLO" : "Common Error SLI"}
                    />
                    <ErrorMsg msg={errors.displayName} />
                  </div>

                  {/* Application Field (New) */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Application Name</label>
                    <div className="relative">
                      <Box className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                      <input 
                        type="text" 
                        value={sloState.app || ''}
                        onChange={(e) => setSloState({...sloState, app: e.target.value})}
                        className={`${getInputClass('app')} pl-9`}
                        placeholder="e.g. payment-service"
                      />
                    </div>
                  </div>
                  
                  {sloState.kind === 'SLO' ? (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Service</label>
                      <div className="relative">
                        <Server className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                        <input 
                          type="text" 
                          value={sloState.service}
                          onChange={(e) => setSloState({...sloState, service: e.target.value})}
                          className={`${getInputClass('service')} pl-9`}
                          placeholder="service-name"
                        />
                      </div>
                      <ErrorMsg msg={errors.service} />
                    </div>
                  ) : (
                     // Spacer for grid alignment if SLI
                     <div /> 
                  )}

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Description</label>
                    <textarea 
                      rows={2}
                      value={sloState.description}
                      onChange={(e) => setSloState({...sloState, description: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                      placeholder="Brief description..."
                    />
                  </div>
                </div>

                {sloState.kind === 'SLO' && (
                  <>
                    <div className="h-px bg-slate-700 my-6" />

                    {/* Objectives */}
                    <h4 className="text-sm font-semibold text-brand-400 flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Objectives
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Target Reliability</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            step="0.001"
                            max="1.0"
                            min="0.0"
                            value={sloState.target}
                            onChange={(e) => setSloState({...sloState, target: parseFloat(e.target.value)})}
                            className={getInputClass('target')}
                          />
                          <span className="text-sm text-slate-500 font-mono w-16 text-right">
                            {!isNaN(sloState.target) ? (sloState.target * 100).toFixed(2) : '0.00'}%
                          </span>
                        </div>
                        <ErrorMsg msg={errors.target} />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Window</label>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <input 
                              type="number" 
                              value={sloState.timeWindowCount}
                              onChange={(e) => setSloState({...sloState, timeWindowCount: parseInt(e.target.value)})}
                              className={getInputClass('timeWindowCount')}
                            />
                          </div>
                          <select 
                            value={sloState.timeWindowUnit}
                            onChange={(e) => setSloState({...sloState, timeWindowUnit: e.target.value as TimeWindowUnit})}
                            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none"
                          >
                            <option value="d">Days</option>
                            <option value="w">Weeks</option>
                            <option value="h">Hours</option>
                            <option value="m">Minutes</option>
                          </select>
                        </div>
                        <ErrorMsg msg={errors.timeWindowCount} />
                      </div>
                    </div>
                  </>
                )}

                <div className="h-px bg-slate-700 my-6" />

                {/* Indicator Section Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <h4 className="text-sm font-semibold text-brand-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Service Level Indicator (SLI)
                  </h4>
                  
                  {sloState.kind === 'SLO' ? (
                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                      <button
                        onClick={() => setSloState(prev => ({ ...prev, indicatorMode: 'inline' }))}
                        className={`px-3 py-1 text-xs rounded-md transition-all flex items-center gap-1 ${
                          sloState.indicatorMode === 'inline' 
                          ? 'bg-slate-700 text-white shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Code className="h-3 w-3" /> Inline Definition
                      </button>
                      <button
                        onClick={() => setSloState(prev => ({ ...prev, indicatorMode: 'reference' }))}
                        className={`px-3 py-1 text-xs rounded-md transition-all flex items-center gap-1 ${
                          sloState.indicatorMode === 'reference' 
                          ? 'bg-slate-700 text-white shadow' 
                          : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Link className="h-3 w-3" /> Reference SLI
                      </button>
                    </div>
                  ) : (
                    <div className="px-3 py-1 bg-purple-900/20 text-purple-300 text-xs rounded border border-purple-800/50">
                      Defining shared SLI
                    </div>
                  )}
                </div>

                {/* SLI Reference Input (Only for SLO + Reference Mode) */}
                {sloState.kind === 'SLO' && sloState.indicatorMode === 'reference' && (
                  <div className="p-6 bg-slate-900/50 rounded-xl border border-slate-700/50 animate-fadeIn space-y-3">
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <Link className="h-3 w-3" />
                      Referenced SLI Name
                    </label>
                    
                    {/* Data List for Saved SLIs */}
                    <div className="relative">
                      <input 
                        list="saved-slis"
                        type="text"
                        value={sloState.indicatorRef || ''}
                        onChange={(e) => setSloState({ ...sloState, indicatorRef: e.target.value })}
                        placeholder="e.g. common-errors-sli"
                        className={getInputClass('indicatorRef')}
                        autoComplete="off"
                      />
                      <datalist id="saved-slis">
                         {savedItems
                            .filter(i => i.kind === 'SLI')
                            .map(i => (
                               <option key={i.id} value={i.name}>
                                  {i.displayName} (v1)
                               </option>
                            ))
                         }
                      </datalist>
                    </div>
                    
                    <p className="text-xs text-slate-500">
                      Select a saved SLI from the dropdown or enter the name manually.
                    </p>
                    <ErrorMsg msg={errors.indicatorRef} />
                  </div>
                )}

                {/* Metric Builder (For SLI Kind OR SLO Inline Mode) */}
                {(sloState.kind === 'SLI' || (sloState.kind === 'SLO' && sloState.indicatorMode === 'inline')) && (
                  <div className="animate-fadeIn">
                    {/* Metric Type Selector */}
                    <div className="flex gap-2 mb-4">
                      <button
                        onClick={() => handleIndicatorTypeChange('threshold')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          sloState.indicatorType === 'threshold'
                            ? 'bg-slate-700 border-slate-600 text-white' 
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        Threshold Metric
                      </button>
                      <button
                        onClick={() => handleIndicatorTypeChange('ratio')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          sloState.indicatorType === 'ratio'
                            ? 'bg-slate-700 border-slate-600 text-white' 
                            : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        Ratio Metric
                      </button>
                    </div>

                    {sloState.indicatorType === 'threshold' && (
                      <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 space-y-4 animate-fadeIn">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Metric Query (PromQL/Datadog)</label>
                          <textarea 
                            rows={2}
                            value={sloState.thresholdMetric?.source.query || ''}
                            onChange={(e) => setSloState({
                              ...sloState, 
                              thresholdMetric: { 
                                ...sloState.thresholdMetric!, 
                                source: { ...sloState.thresholdMetric!.source, query: e.target.value }
                              }
                            })}
                            className={`${getInputClass('thresholdQuery')} font-mono`}
                            placeholder="e.g. http_request_duration_seconds_bucket"
                          />
                          <ErrorMsg msg={errors.thresholdQuery} />
                        </div>
                        <div className="flex gap-4">
                           <div className="space-y-2 w-1/3">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Operator</label>
                            <select 
                              value={sloState.thresholdMetric?.operator || 'lte'}
                              onChange={(e) => setSloState({
                                ...sloState, 
                                thresholdMetric: { ...sloState.thresholdMetric!, operator: e.target.value as any }
                              })}
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500 outline-none"
                            >
                              <option value="lte">{'<='}</option>
                              <option value="lt">{'<'}</option>
                              <option value="gte">{'>='}</option>
                              <option value="gt">{'>'}</option>
                            </select>
                          </div>
                          <div className="space-y-2 flex-1">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Threshold Value</label>
                            <input 
                              type="number"
                              value={sloState.thresholdMetric?.value || 0}
                              onChange={(e) => setSloState({
                                ...sloState, 
                                thresholdMetric: { ...sloState.thresholdMetric!, value: parseFloat(e.target.value) }
                              })}
                              className={getInputClass('thresholdValue')}
                            />
                            <ErrorMsg msg={errors.thresholdValue} />
                          </div>
                        </div>
                      </div>
                    )}

                    {sloState.indicatorType === 'ratio' && (
                      <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 space-y-4 animate-fadeIn">
                          <ErrorMsg msg={errors.ratioGoodBad} />
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <label className="text-xs font-medium text-green-400 uppercase tracking-wider">Good Metric (Numerator)</label>
                              <span className="text-[10px] text-slate-500">Optional if Bad Metric is set</span>
                            </div>
                            <input 
                              type="text"
                              value={sloState.ratioMetric?.good?.query || ''}
                              onChange={(e) => setSloState({
                                ...sloState, 
                                ratioMetric: { 
                                  ...(sloState.ratioMetric || { total: { type: 'prometheus', query: '' } }), 
                                  good: { type: 'prometheus', query: e.target.value }
                                }
                              })}
                              placeholder="Query for successful requests"
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 focus:ring-1 focus:ring-brand-500 outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <label className="text-xs font-medium text-red-400 uppercase tracking-wider">Bad Metric (Numerator)</label>
                              <span className="text-[10px] text-slate-500">Optional if Good Metric is set</span>
                            </div>
                            <input 
                              type="text"
                              value={sloState.ratioMetric?.bad?.query || ''}
                              onChange={(e) => setSloState({
                                ...sloState, 
                                ratioMetric: { 
                                  ...(sloState.ratioMetric || { total: { type: 'prometheus', query: '' } }), 
                                  bad: { type: 'prometheus', query: e.target.value }
                                }
                              })}
                              placeholder="Query for failed requests"
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm font-mono text-slate-300 focus:ring-1 focus:ring-brand-500 outline-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Metric (Denominator)</label>
                            <input 
                              type="text"
                              value={sloState.ratioMetric?.total?.query || ''}
                              onChange={(e) => setSloState({
                                ...sloState, 
                                ratioMetric: { 
                                  ...(sloState.ratioMetric || { total: { type: 'prometheus', query: '' } }), 
                                  total: { type: 'prometheus', query: e.target.value }
                                }
                              })}
                              placeholder="Query for total requests"
                              className={getInputClass('ratioTotal') + ' font-mono'}
                            />
                            <ErrorMsg msg={errors.ratioTotal} />
                          </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview Column */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-24">
              <div className={`bg-slate-800 rounded-2xl border transition-colors overflow-hidden shadow-xl flex flex-col max-h-[calc(100vh-8rem)] ${!isValid ? 'border-red-900/50' : 'border-slate-700'}`}>
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <FileJson className={`h-5 w-5 ${!isValid ? 'text-red-400' : 'text-brand-400'}`} />
                      {sloState.kind === 'SLO' ? 'SLO YAML' : 'SLI YAML'}
                    </h3>
                    {!isValid && <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full border border-red-800">Invalid</span>}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={downloadYaml}
                      disabled={!isValid}
                      className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={!isValid ? "Fix errors to download" : "Download YAML"}
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={copyToClipboard}
                      disabled={!isValid}
                      className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title={!isValid ? "Fix errors to copy" : "Copy to Clipboard"}
                    >
                      {copySuccess ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-[#0d1117] custom-scrollbar p-0 relative">
                  <pre className={`p-4 text-sm font-mono leading-relaxed transition-opacity ${!isValid ? 'opacity-50' : 'text-slate-300'}`}>
                    <code className="language-yaml">{yamlOutput}</code>
                  </pre>
                  {!isValid && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <div className="bg-red-900/20 backdrop-blur-sm p-4 rounded-xl border border-red-900/50 text-red-200 flex items-center gap-2">
                         <AlertCircle className="h-5 w-5" />
                         <span>Please fix validation errors</span>
                       </div>
                    </div>
                  )}
                </div>
                <div className="p-4 bg-slate-800 border-t border-slate-700 text-xs text-slate-500 flex justify-between items-center">
                  <span>Generated automatically</span>
                  {isValid && sloState.kind === 'SLO' && sloState.target < 0.9 && (
                    <span className="text-yellow-500 flex items-center gap-1">
                      ⚠️ Target reliability is quite low
                    </span>
                  )}
                  {isValid && sloState.kind === 'SLO' && sloState.target > 0.9999 && (
                    <span className="text-yellow-500 flex items-center gap-1">
                      ⚠️ Target reliability is extremely high
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
