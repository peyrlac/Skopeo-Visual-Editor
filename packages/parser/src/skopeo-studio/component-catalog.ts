import type { T } from '../packages';
import { generate, t, traverse } from '../packages';
import { getAstFromContent } from '../parse';

export type StudioComponentMeta = {
    id: string;
    name: string;
    filePath: string;
    exportName: string;
    exportType: 'named' | 'default';
    importPath: string;
    folder: 'components' | 'views' | 'ui' | 'app' | 'other';
    propTypeName: string | null;
    usesClassName: boolean;
    line: number | null;
};

export function listStudioComponentsFromFiles(
    files: Array<{ path: string; content: string }>,
): StudioComponentMeta[] {
    const components: StudioComponentMeta[] = [];

    for (const file of files) {
        if (!/\.(tsx|jsx)$/.test(file.path)) {
            continue;
        }

        const ast = getAstFromContent(file.content);
        if (!ast) {
            continue;
        }

        traverse(ast, {
            ExportNamedDeclaration(path) {
                const declaration = path.node.declaration;
                if (t.isFunctionDeclaration(declaration)) {
                    addFunctionComponent(components, file, declaration, 'named');
                } else if (t.isVariableDeclaration(declaration)) {
                    for (const declarator of declaration.declarations) {
                        addVariableComponent(components, file, declarator, 'named');
                    }
                }
            },
            ExportDefaultDeclaration(path) {
                const declaration = path.node.declaration;
                if (t.isFunctionDeclaration(declaration)) {
                    addFunctionComponent(components, file, declaration, 'default');
                }
            },
        });
    }

    return components;
}

function addFunctionComponent(
    components: StudioComponentMeta[],
    file: { path: string; content: string },
    declaration: T.FunctionDeclaration,
    exportType: 'named' | 'default',
) {
    const name = declaration.id?.name;
    if (!isComponentName(name)) {
        return;
    }
    if (!containsJsx(declaration)) {
        return;
    }

    addComponent(components, file, declaration, name, exportType, declaration.params[0]);
}

function addVariableComponent(
    components: StudioComponentMeta[],
    file: { path: string; content: string },
    declaration: T.VariableDeclarator,
    exportType: 'named' | 'default',
) {
    if (!t.isIdentifier(declaration.id) || !isComponentName(declaration.id.name)) {
        return;
    }
    if (!t.isArrowFunctionExpression(declaration.init)) {
        return;
    }
    if (!containsJsx(declaration.init)) {
        return;
    }

    addComponent(
        components,
        file,
        declaration,
        declaration.id.name,
        exportType,
        declaration.init.params[0],
    );
}

function addComponent(
    components: StudioComponentMeta[],
    file: { path: string; content: string },
    node: T.FunctionDeclaration | T.VariableDeclarator,
    name: string,
    exportType: 'named' | 'default',
    firstParam: T.FunctionDeclaration['params'][number] | undefined,
) {
    const start = node.start ?? 0;
    const end = node.end ?? start;
    const source = file.content.slice(start, end);

    components.push({
        id: `${file.path}:${name}`,
        name,
        filePath: file.path,
        exportName: exportType === 'default' ? 'default' : name,
        exportType,
        importPath: toImportPath(file.path),
        folder: getFolder(file.path),
        propTypeName: getPropTypeName(firstParam),
        usesClassName: source.includes('className'),
        line: node.loc?.start.line ?? null,
    });
}

function getPropTypeName(
    param: T.FunctionDeclaration['params'][number] | undefined,
): string | null {
    if (
        !t.isIdentifier(param) ||
        !param.typeAnnotation ||
        !t.isTSTypeAnnotation(param.typeAnnotation)
    ) {
        return null;
    }
    return generate(param.typeAnnotation.typeAnnotation).code;
}

function isComponentName(name: string | undefined): name is string {
    return Boolean(name && /^[A-Z]/.test(name));
}

function containsJsx(node: T.Node | null | undefined): boolean {
    if (!node) {
        return false;
    }
    if (t.isJSXElement(node) || t.isJSXFragment(node)) {
        return true;
    }

    const visitorKeys = t.VISITOR_KEYS[node.type] ?? [];
    return visitorKeys.some((key) => {
        const child = (node as unknown as Record<string, unknown>)[key];
        if (Array.isArray(child)) {
            return child.some((item) => isAstNode(item) && containsJsx(item));
        }
        return isAstNode(child) && containsJsx(child);
    });
}

function isAstNode(value: unknown): value is T.Node {
    return typeof value === 'object' && value !== null && 'type' in value;
}

function getFolder(filePath: string): StudioComponentMeta['folder'] {
    const segments = filePath.replaceAll('\\', '/').split('/');
    for (const folder of ['ui', 'components', 'views', 'app'] as const) {
        if (segments.includes(folder)) {
            return folder;
        }
    }
    return 'other';
}

function toImportPath(filePath: string): string {
    const normalized = filePath.replaceAll('\\', '/');
    const withoutSrc = normalized.startsWith('src/') ? normalized.slice(4) : normalized;
    const withoutExtension = withoutSrc.replace(/\.(tsx|jsx)$/, '');
    return `@/${withoutExtension}`;
}
