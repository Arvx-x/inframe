import { createContext, useContext, useState, ReactNode } from 'react';

interface ProjectColorsContextType {
    projectColors: string[];
    addColors: (colors: string[]) => void;
    removeColor: (color: string) => void;
    clearColors: () => void;
}

const ProjectColorsContext = createContext<ProjectColorsContextType | undefined>(undefined);

export function ProjectColorsProvider({ children }: { children: ReactNode }) {
    const [projectColors, setProjectColors] = useState<string[]>([
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'
    ]);

    const addColors = (colors: string[]) => {
        setProjectColors(prev => {
            const newColors = colors.filter(c => !prev.includes(c));
            return [...prev, ...newColors].slice(0, 14); // Max 14 colors
        });
    };

    const removeColor = (color: string) => {
        setProjectColors(prev => prev.filter(c => c !== color));
    };

    const clearColors = () => {
        setProjectColors([]);
    };

    return (
        <ProjectColorsContext.Provider value={{ projectColors, addColors, removeColor, clearColors }}>
            {children}
        </ProjectColorsContext.Provider>
    );
}

export function useProjectColors() {
    const context = useContext(ProjectColorsContext);
    if (!context) {
        throw new Error('useProjectColors must be used within ProjectColorsProvider');
    }
    return context;
}
