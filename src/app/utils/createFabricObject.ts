import {
    Rect,
    Circle,
    Triangle,
    Line,
    Ellipse,
    Polygon,
    Textbox,
    FabricObject
} from 'fabric';

interface ObjectDefinition {
    id: string;
    type: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    radius?: number;
    opacity?: number;
    shadow?: string;
    borderRadius?: number;
    points?: number[][] | { x: number; y: number }[];
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: string;
    text?: string;
    textAlign?: string;
    angle?: number;
    scaleX?: number;
    scaleY?: number;
    rx?: number;
    ry?: number;
}

/**
 * Creates a Fabric.js object from an AI-generated object definition
 * @param definition - Object definition from Design DNA API
 * @returns Fabric.js object ready to add to canvas
 */
export function createFabricObject(definition: ObjectDefinition): FabricObject | null {
    try {
        const {
            id,
            type,
            fill = '#000000',
            stroke,
            strokeWidth = 0,
            left = 0,
            top = 0,
            width = 100,
            height = 100,
            radius,
            opacity = 1,
            shadow,
            borderRadius,
            points,
            fontFamily = 'Arial',
            fontSize = 16,
            fontWeight = 'normal',
            text = '',
            textAlign = 'left',
            angle = 0,
            scaleX = 1,
            scaleY = 1,
            rx,
            ry
        } = definition;

        let fabricObject: FabricObject | null = null;

        switch (type.toLowerCase()) {
            case 'rect':
            case 'rectangle':
                fabricObject = new Rect({
                    left,
                    top,
                    width,
                    height,
                    fill,
                    stroke,
                    strokeWidth,
                    rx: borderRadius || rx || 0,
                    ry: borderRadius || ry || 0,
                });
                break;

            case 'circle':
                fabricObject = new Circle({
                    left,
                    top,
                    radius: radius || Math.min(width, height) / 2,
                    fill,
                    stroke,
                    strokeWidth,
                });
                break;

            case 'ellipse':
                fabricObject = new Ellipse({
                    left,
                    top,
                    rx: rx || width / 2,
                    ry: ry || height / 2,
                    fill,
                    stroke,
                    strokeWidth,
                });
                break;

            case 'triangle':
                fabricObject = new Triangle({
                    left,
                    top,
                    width,
                    height,
                    fill,
                    stroke,
                    strokeWidth,
                });
                break;

            case 'line':
                fabricObject = new Line(
                    [left, top, left + (width || 100), top + (height || 0)],
                    {
                        stroke: stroke || fill,
                        strokeWidth: strokeWidth || 2,
                    }
                );
                break;

            case 'polygon':
                if (points && points.length > 0) {
                    // Convert points to proper format
                    const formattedPoints = points.map(p =>
                        Array.isArray(p) ? { x: p[0], y: p[1] } : p
                    );
                    fabricObject = new Polygon(formattedPoints, {
                        left,
                        top,
                        fill,
                        stroke,
                        strokeWidth,
                    });
                }
                break;

            case 'text':
            case 'textbox':
                fabricObject = new Textbox(text, {
                    left,
                    top,
                    width,
                    fontSize,
                    fontFamily,
                    fontWeight,
                    fill,
                    textAlign: textAlign as any,
                    stroke,
                    strokeWidth,
                });
                break;

            default:
                console.warn(`Unknown object type: ${type}`);
                return null;
        }

        if (fabricObject) {
            // Apply common properties
            fabricObject.set({
                opacity,
                angle,
                scaleX,
                scaleY,
            });

            // Set ID for tracking
            (fabricObject as any).id = id;

            // Apply shadow if specified
            if (shadow) {
                try {
                    // Shadow format: "0px 4px 6px rgba(0,0,0,0.1)"
                    const shadowParts = shadow.match(/(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+(rgba?\([^)]+\)|#[0-9a-fA-F]+)/);
                    if (shadowParts) {
                        fabricObject.set({
                            shadow: {
                                offsetX: parseInt(shadowParts[1]),
                                offsetY: parseInt(shadowParts[2]),
                                blur: parseInt(shadowParts[3]),
                                color: shadowParts[4],
                            } as any
                        });
                    }
                } catch (e) {
                    console.warn('Failed to parse shadow:', shadow, e);
                }
            }

            return fabricObject;
        }

        return null;
    } catch (error) {
        console.error('Error creating Fabric object:', error, definition);
        return null;
    }
}

/**
 * Creates multiple Fabric.js objects from an array of definitions
 * @param definitions - Array of object definitions
 * @returns Array of created Fabric.js objects
 */
export function createFabricObjects(definitions: ObjectDefinition[]): FabricObject[] {
    return definitions
        .map(def => createFabricObject(def))
        .filter((obj): obj is FabricObject => obj !== null);
}
