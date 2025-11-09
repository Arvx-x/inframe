# Canvas Commands Guide

## Overview
Canvas mode allows you to control objects on the canvas using natural language commands through the promptbox. The AI agent interprets your commands and executes structured actions.

## How to Use Canvas Mode

1. **Switch to Canvas Mode**
   - Click the dropdown menu next to the input box (shows current mode icon)
   - Select "Canvas Mode" from the dropdown
   - The input placeholder will change to "Tell the canvas what to do..."

2. **Give Commands**
   - Type natural language commands
   - Press Enter or click the send button
   - The AI will interpret and execute your command
   - You'll see a confirmation message

## Available Commands

### Alignment Commands
- `center everything` - Center all objects on canvas
- `align to left` - Align objects to the left
- `align to top` - Align objects to the top
- `center horizontally` - Center objects horizontally only
- `center vertically` - Center objects vertically only

### Movement Commands
- `move to top-left` - Move objects to top-left corner
- `move the image to the right` - Move specific object type
- `move everything down` - Move all objects down

### Resize Commands
- `make smaller` - Reduce size by 20%
- `make larger` - Increase size by 25%
- `make images bigger` - Scale specific object types
- `resize to 50%` - Set specific scale

### Text Commands
- `add text "Welcome"` - Add new text
- `add heading "Hello World"` - Add heading text
- `delete the text` - Remove text objects

### Layout Commands
- `place side by side` - Arrange objects horizontally
- `space them out` - Add spacing between objects

### Delete Commands
- `delete everything` - Remove all objects
- `delete the circles` - Remove specific object types
- `remove the first image` - Remove specific object

## Tips for Better Results

1. **Be Specific**: Instead of "move it", say "move the image to top-left"
2. **Use Object Types**: Refer to "text", "image", "rectangle", "circle"
3. **Combine Actions**: "center the text and make it larger"
4. **Natural Language**: Commands like "put them side by side" work well

## Undo/Redo

- **Undo**: Cmd/Ctrl + Z
- **Redo**: Cmd/Ctrl + Shift + Z or Cmd/Ctrl + Y

Canvas commands support undo/redo, so you can experiment freely!

## Examples

### Basic Commands
```
center everything
make all images smaller
add text "Hello World"
delete the text
```

### Advanced Commands
```
move the first image to top-left and make it larger
center all text vertically
place the rectangles side by side with spacing
resize all images to 80%
```

## Troubleshooting

**Command not working?**
- Check the browser console for error messages
- Ensure you're in Canvas mode (look for the cursor icon)
- Make sure there are objects on the canvas to manipulate
- Verify your INFRAME_API_KEY is set in .env.local

**AI not understanding?**
- Try rephrasing with clearer object references
- Use specific object types (image, text, rectangle, circle)
- Break complex commands into simpler steps

## Technical Details

Canvas commands are processed through:
1. User input → PromptSidebar (Canvas mode)
2. Command sent to Canvas component
3. Canvas state sent to `/api/canvas-command`
4. AI (Gemini) interprets command and returns actions
5. Actions executed on canvas using Fabric.js
6. Inverse actions saved for undo

For developers: See `inframe/src/app/lib/agent/canvas-schema.ts` for action types and `inframe/src/app/lib/agent/executor.ts` for action execution logic.

