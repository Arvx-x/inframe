'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Sparkles, Image, Palette, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/app/components/ui/input';

interface GlobalSearchBarProps {
  projectName: string;
}

type SearchCategory = 'all' | 'assets' | 'inspirations' | 'personality';

interface SearchResult {
  id: string;
  type: 'asset' | 'inspiration' | 'personality';
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function GlobalSearchBar({ projectName }: GlobalSearchBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const COLLAPSED_HEIGHT_PX = 40; // matches h-10
  const EXPANDED_HEIGHT_PX = 320;
  const ANIM_MS = 300;

  function open() {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    setIsCollapsing(false);
    setIsExpanded(true);
  }

  function close() {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
    // Keep the expanded corner style during height collapse, then switch to pill after transition.
    setIsCollapsing(true);
    setIsExpanded(false);
    inputRef.current?.blur();
    collapseTimerRef.current = setTimeout(() => {
      setIsCollapsing(false);
    }, ANIM_MS);
  }

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
    };
  }, []);

  // Sample data for demonstration
  const sampleResults: SearchResult[] = [
    { id: '1', type: 'asset', title: 'Logo.png', subtitle: 'Uploaded 2 days ago', icon: <Image className="w-4 h-4" /> },
    { id: '2', type: 'asset', title: 'Brand Guidelines.pdf', subtitle: 'Uploaded 1 week ago', icon: <Image className="w-4 h-4" /> },
    { id: '3', type: 'inspiration', title: 'Minimal Design Board', subtitle: '12 pins', icon: <Sparkles className="w-4 h-4" /> },
    { id: '4', type: 'inspiration', title: 'Color Palette Ideas', subtitle: '8 pins', icon: <Sparkles className="w-4 h-4" /> },
    { id: '5', type: 'personality', title: 'Bold & Modern', subtitle: 'Your design style', icon: <Palette className="w-4 h-4" /> },
    { id: '6', type: 'personality', title: 'Clean Typography', subtitle: 'Font preferences', icon: <Palette className="w-4 h-4" /> },
  ];

  // Filter results based on query and category
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const filtered = sampleResults.filter((result) => {
      const matchesQuery = result.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        result.subtitle?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || 
        (activeCategory === 'assets' && result.type === 'asset') ||
        (activeCategory === 'inspirations' && result.type === 'inspiration') ||
        (activeCategory === 'personality' && result.type === 'personality');
      return matchesQuery && matchesCategory;
    });

    setSearchResults(filtered);
  }, [searchQuery, activeCategory]);

  // Click outside to close (PromptSidebar-like)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        close();
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // Auto-expand when input is focused or has content
  useEffect(() => {
    if (searchQuery.trim() || (inputRef.current && document.activeElement === inputRef.current)) {
      open();
    }
  }, [searchQuery]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isExpanded]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isExpanded) {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const categories: { key: SearchCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'assets', label: 'Assets' },
    { key: 'inspirations', label: 'Inspirations' },
    { key: 'personality', label: 'Design DNA' },
  ];

  const getTypeColor = (type: SearchResult['type']) => {
    switch (type) {
      case 'asset': return 'bg-blue-100 text-blue-700';
      case 'inspiration': return 'bg-blue-100 text-blue-700';
      case 'personality': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeLabel = (type: SearchResult['type']) => {
    switch (type) {
      case 'asset': return 'Asset';
      case 'inspiration': return 'Inspiration';
      case 'personality': return 'Design DNA';
      default: return 'Item';
    }
  };

  return (
    <div ref={containerRef} style={{ width: '560px' }}>
      {/* Single unified container (PromptSidebar-style): height animates, overflow hides content */}
      <div
        className={`bg-gray-100 overflow-hidden border transition-[height,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isExpanded
            ? 'rounded-2xl border-gray-200 shadow-lg'
            : isCollapsing
              ? 'rounded-2xl border-gray-200 shadow-none'
              : 'rounded-full border-transparent shadow-none'
        }`}
        style={{
          height: isExpanded ? `${EXPANDED_HEIGHT_PX}px` : `${COLLAPSED_HEIGHT_PX}px`,
        }}
      >
        <div className="relative h-full flex flex-col">
          {/* Top bar (always visible) */}
          <div className="relative h-10 flex items-center">
            <Search
              className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${
                isExpanded ? 'text-gray-600' : 'text-gray-400'
              }`}
            />
            <Input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onMouseDown={() => {
                // Ensure we switch to left-aligned/caret state immediately on click
                setIsFocused(true);
              }}
              onFocus={() => {
                setIsFocused(true);
                open();
              }}
              onBlur={() => setIsFocused(false)}
              // Hide placeholder on focus so the caret is the primary affordance (PromptSidebar-like)
              placeholder={isFocused ? '' : projectName}
              className={`h-10 w-full bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm font-medium pl-11 pr-10 ${
                searchQuery.trim() || isFocused
                  ? 'text-left text-gray-900'
                  : 'text-center placeholder:text-gray-500'
              }`}
            />
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (isExpanded) close();
                else open();
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded transition-colors"
              aria-label={isExpanded ? 'Collapse search' : 'Expand search'}
            >
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-gray-500 transition-transform duration-300" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 transition-colors duration-200" />
              )}
            </button>
          </div>

          {/* Body (revealed by container height) */}
          <div
            className={`flex-1 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            {/* Category tabs */}
            <div className="px-3 py-2 border-t border-gray-200 border-b border-gray-200 flex gap-1.5">
              {categories.map((category) => (
                <button
                  key={category.key}
                  onClick={() => setActiveCategory(category.key)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all duration-200 ${
                    activeCategory === category.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {searchQuery.trim() ? (
                <div className="p-2">
                  {searchResults.length > 0 ? (
                    <div className="space-y-1">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors text-left group"
                        >
                          <div className={`p-2 rounded-lg ${getTypeColor(result.type)}`}>{result.icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                            {result.subtitle && <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>}
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getTypeColor(
                              result.type
                            )} opacity-0 group-hover:opacity-100 transition-opacity`}
                          >
                            {getTypeLabel(result.type)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center">
                      <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">No results found for &quot;{searchQuery}&quot;</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">Quick Access</p>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setActiveCategory('assets')}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                    >
                      <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
                        <Image className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-gray-700">Assets</span>
                    </button>
                    <button
                      onClick={() => setActiveCategory('inspirations')}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                    >
                      <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-gray-700">Inspirations</span>
                    </button>
                    <button
                      onClick={() => setActiveCategory('personality')}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors group"
                    >
                      <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-200 transition-colors">
                        <Palette className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-medium text-gray-700">Design DNA</span>
                    </button>
                  </div>

                  <div className="mt-3">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 px-1">Recent</p>
                    <div className="space-y-0.5">
                      <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <Search className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">brand colors</span>
                      </button>
                      <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                        <Search className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-600">logo variations</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50/80">
              <p className="text-xs text-gray-400 text-center">
                Press{' '}
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600 font-mono text-[10px]">Esc</kbd> to close
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
