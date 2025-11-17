<!-- 855e9708-1574-483d-a48a-3323250c43ed f626b31e-6cc6-4efa-86de-9c7f43c5ba74 -->
# Rebuild Pen Tool with Figma-like Sub-toolbar

## Overview

Transform the pen tool to work like Figma with a sub-toolbar that appears when pen tool is selected, containing pointer and curve buttons. Nodes and toolbar are visible DURING path creation. Path stops drawing when closed figure is made and a node is clicked, otherwise continues drawing. Double-click exits editing mode.

## Key Changes

### 1. Remove Existing Pen Tool Functionality

- Remove `penMode` state and dropdown menu from `Toolbar.tsx`
- Remove curve mode logic from path creation in `Canvas.tsx`
- Simplify pen tool to always create straight lines initially

### 2. Add Pen Sub-toolbar Component

- Create new sub-toolbar that appears next to main toolbar when pen tool is active
- Position it to the right of the main toolbar
- Contains two buttons: "Pointer" and "Curve"
- Sub-toolbar remains visible during entire path creation/editing session
- Add new state: `penSubTool` with values `'draw' | 'pointer' | 'curve'`
- Default to `'draw'` mode when pen tool is first selected

### 3. Modify Path Creation Flow

- Path creation: clicking adds points with straight lines
- Nodes become visible immediately after first point is added
- Sub-toolbar becomes visible when pen tool is selected
- Path continues drawing until:
- Closed figure is made (click near start point) AND a node is clicked after closing → stops drawing
- Otherwise, continues drawing with nodes and toolbar visible
- Path remains in editing mode until double-click on canvas exits

### 4. Implement Pointer Mode

- When pointer button is clicked, set `penSubTool` to `'pointer'`
- In pointer mode:
- Enable dragging existing anchor points to reshape path
- Allow adding new points, but ONLY to midpoints of existing line segments (like Figma)
- Detect when clicking near midpoint of a segment (within threshold)
- Insert new point at midpoint when clicked
- Show cursor as pointer/move when hovering over nodes
- Prevent adding points to empty canvas areas

### 5. Implement Curve Mode

- When curve button is clicked, set `penSubTool` to `'curve'`
- In curve mode:
- Click and drag on a straight line segment to convert it to a curve
- Create control points (bezier handles) for the segment
- Visual feedback when hovering over segments that can be curved
- Allow adjusting curve handles after conversion

### 6. Update Path Editor Integration

- Modify path creation to show nodes during drawing (not after)
- Keep nodes visible throughout entire editing session
- Handle double-click on canvas to exit editing mode (hide nodes and sub-toolbar)
- Update path completion logic to stop drawing when closed + node clicked

### 7. Update Canvas Event Handlers

- Modify `mouse:down` handler to check `penSubTool` state
- In `'draw'` mode: add points, show nodes immediately
- In `'pointer'` mode: 
- Allow node dragging
- Detect midpoint clicks on segments and insert points
- Prevent adding points elsewhere
- In `'curve'` mode: detect segment clicks and convert to curves
- Add double-click handler to exit editing mode (clear node visibility and hide sub-toolbar)
- Handle path closing: when path is closed AND a node is clicked, stop drawing mode

## Files to Modify

1. **`inframe/src/app/components/Toolbar.tsx`**

- Remove pen mode dropdown
- Remove `penMode` prop and state
- Add pen sub-toolbar component that conditionally renders when `activeToolbarButton === 'pen'`

2. **`inframe/src/app/components/Canvas.tsx`**

- Remove `penMode` state and ref
- Add `penSubTool` state: `'draw' | 'pointer' | 'curve'`
- Modify path creation to show nodes immediately after first point
- Update path creation logic to work with sub-tool modes
- Add logic to keep nodes visible during path creation
- Modify mouse handlers to respect `penSubTool` mode
- Add double-click handler to exit editing mode
- Remove curve mode logic from initial path creation
- Handle path closing: stop drawing when closed + node clicked

3. **`inframe/src/app/components/PathEditor.tsx`** (if needed)

- May need updates to work with new editing flow
- Ensure it handles the new pointer and curve modes
- Support midpoint point insertion in pointer mode

## Implementation Details

- Sub-toolbar should be positioned absolutely next to main toolbar
- Use similar styling to main toolbar for consistency
- Nodes and sub-toolbar visible during path creation (from first point)
- Pointer mode allows adding points only to segment midpoints (like Figma)
- Curve mode should detect closest segment and convert on drag
- Double-click anywhere on canvas (when in pen editing mode) should exit and hide nodes/toolbar
- Path stops drawing when closed figure is made and a node is clicked after closing

### To-dos

- [ ] Remove existing penMode state, dropdown menu, and curve mode logic from Toolbar.tsx and Canvas.tsx
- [ ] Create pen sub-toolbar component that appears when pen tool is active, with pointer and curve buttons
- [ ] Add penSubTool state ('draw' | 'pointer' | 'curve') to manage sub-tool selection
- [ ] Update path creation to automatically enter editing mode after first point, keeping nodes visible
- [ ] Implement pointer mode: disable point creation, enable node dragging for reshaping paths
- [ ] Implement curve mode: click and drag on straight segments to convert them to curves with bezier handles
- [ ] Add double-click handler to exit editing mode and hide nodes
- [ ] Update canvas mouse event handlers to respect penSubTool mode and prevent unwanted interactions