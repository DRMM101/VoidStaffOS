// Copyright © 2026 D.R.M. Manthorpe. All rights reserved.
// Proprietary and confidential. Unauthorised copying, modification,
// or distribution is strictly prohibited.

/**
 * HeadOfficeOS — OrgChart Component
 * Tree renderer with pan (mousedown+drag) and zoom (scroll wheel).
 * Wraps OrgNode recursion in a pannable/zoomable container.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Expand, Shrink } from 'lucide-react';
import OrgNode from './OrgNode';

/** Zoom limits */
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

function OrgChart({ tree, highlightId, onNodeClick }) {
  // Pan state: translate offset for the tree container
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  // Zoom state: CSS scale factor
  const [scale, setScale] = useState(1);
  // Track which nodes are expanded (all expanded by default)
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  // Pan drag tracking
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });
  // Container ref for event listeners
  const containerRef = useRef(null);

  /**
   * Initialise expandedNodes with all node IDs when tree loads.
   * Collects IDs recursively from the tree structure.
   */
  useEffect(() => {
    const collectIds = (nodes) => {
      const ids = new Set();
      nodes.forEach(n => {
        ids.add(n.id);
        if (n.children) {
          collectIds(n.children).forEach(id => ids.add(id));
        }
      });
      return ids;
    };
    if (tree && tree.length > 0) {
      setExpandedNodes(collectIds(tree));
    }
  }, [tree]);

  /** Toggle a single node's expanded state */
  const handleToggleExpand = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  /** Expand all nodes */
  const handleExpandAll = useCallback(() => {
    const collectIds = (nodes) => {
      const ids = new Set();
      nodes.forEach(n => {
        ids.add(n.id);
        if (n.children) collectIds(n.children).forEach(id => ids.add(id));
      });
      return ids;
    };
    setExpandedNodes(collectIds(tree));
  }, [tree]);

  /** Collapse all nodes */
  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  /** Zoom in by one step */
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(MAX_ZOOM, Math.round((prev + ZOOM_STEP) * 10) / 10));
  }, []);

  /** Zoom out by one step */
  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(MIN_ZOOM, Math.round((prev - ZOOM_STEP) * 10) / 10));
  }, []);

  /** Reset zoom and pan to defaults */
  const handleFitToScreen = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  /** Mouse wheel zoom handler */
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale(prev => {
      const next = Math.round((prev + delta) * 10) / 10;
      return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    });
  }, []);

  /** Pan: mouse down starts drag */
  const handleMouseDown = useCallback((e) => {
    // Only pan on left-click on the background (not on nodes)
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY };
    translateStart.current = { ...translate };
    // Change cursor to grabbing
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  }, [translate]);

  /** Pan: mouse move updates translate */
  const handleMouseMove = useCallback((e) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTranslate({
      x: translateStart.current.x + dx,
      y: translateStart.current.y + dy
    });
  }, []);

  /** Pan: mouse up ends drag */
  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
  }, []);

  // Attach wheel listener with passive: false to allow preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  return (
    <div className="org-chart">
      {/* Toolbar: zoom controls + expand/collapse */}
      <div className="org-chart__toolbar" role="toolbar" aria-label="Org chart controls">
        <button onClick={handleZoomIn} title="Zoom in" aria-label="Zoom in" className="org-chart__tool-btn">
          <ZoomIn size={16} />
        </button>
        <button onClick={handleZoomOut} title="Zoom out" aria-label="Zoom out" className="org-chart__tool-btn">
          <ZoomOut size={16} />
        </button>
        <button onClick={handleFitToScreen} title="Fit to screen" aria-label="Fit to screen" className="org-chart__tool-btn">
          <Maximize2 size={16} />
        </button>
        <span className="org-chart__zoom-label">{Math.round(scale * 100)}%</span>
        <span className="org-chart__separator" aria-hidden="true" />
        <button onClick={handleExpandAll} title="Expand all" aria-label="Expand all" className="org-chart__tool-btn">
          <Expand size={16} />
        </button>
        <button onClick={handleCollapseAll} title="Collapse all" aria-label="Collapse all" className="org-chart__tool-btn">
          <Shrink size={16} />
        </button>
      </div>

      {/* Pannable/zoomable viewport */}
      <div
        className="org-chart__viewport"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: 'grab' }}
        role="img"
        aria-label="Organisation chart"
      >
        <div
          className="org-chart__canvas"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'top center'
          }}
        >
          {/* Render root nodes — each is a subtree */}
          {tree.map(rootNode => (
            <OrgNode
              key={rootNode.id}
              node={rootNode}
              expandedNodes={expandedNodes}
              onToggleExpand={handleToggleExpand}
              highlightId={highlightId}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default OrgChart;
