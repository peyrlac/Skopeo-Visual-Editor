export type StudioPanelMode = 'chat' | 'studio';

export type StudioSelectedElementView = {
    oid: string | null;
    domId: string;
    tagName: string;
    text: string | null;
};
