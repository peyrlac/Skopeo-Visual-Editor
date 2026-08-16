import { EditorAttributes } from '@onlook/constants';
import { getAstFromContent } from '../parse';
import type { NodePath, T } from '../packages';
import { generate, t, traverse } from '../packages';

export type StudioClassNameInfo =
    | { kind: 'static'; value: string }
    | { kind: 'missing'; value: null }
    | { kind: 'unsupported'; value: string; reason: string };

export type StudioElementSource = {
    oid: string;
    filePath: string;
    tagName: string;
    componentName: string | null;
    line: number | null;
    column: number | null;
    className: StudioClassNameInfo;
};

export function resolveElementSourceFromFiles(
    files: Array<{ path: string; content: string }>,
    oid: string,
): StudioElementSource | null {
    for (const file of files) {
        const match = resolveElementSourceInFile(file.path, file.content, oid);
        if (match) {
            return match;
        }
    }
    return null;
}

export function resolveElementSourceInFile(
    filePath: string,
    content: string,
    oid: string,
): StudioElementSource | null {
    const ast = getAstFromContent(content);
    if (!ast) {
        return null;
    }

    let result: StudioElementSource | null = null;

    traverse(ast, {
        JSXOpeningElement(path) {
            if (result) {
                path.stop();
                return;
            }

            const dataOid = getStringAttribute(path.node, EditorAttributes.DATA_ONLOOK_ID);
            if (dataOid !== oid) {
                return;
            }

            result = {
                oid,
                filePath,
                tagName: getTagName(path.node.name),
                componentName: findComponentName(path),
                line: path.node.loc?.start.line ?? null,
                column: path.node.loc?.start.column ?? null,
                className: getClassNameInfo(path.node),
            };
            path.stop();
        },
    });

    return result;
}

function getStringAttribute(node: T.JSXOpeningElement, name: string): string | null {
    const attr = node.attributes.find(
        (attribute) => t.isJSXAttribute(attribute) && attribute.name.name === name,
    );
    if (!attr || !t.isJSXAttribute(attr) || !attr.value || !t.isStringLiteral(attr.value)) {
        return null;
    }
    return attr.value.value;
}

function getClassNameInfo(node: T.JSXOpeningElement): StudioClassNameInfo {
    const attr = node.attributes.find(
        (attribute) => t.isJSXAttribute(attribute) && attribute.name.name === 'className',
    );

    if (!attr || !t.isJSXAttribute(attr) || !attr.value) {
        return { kind: 'missing', value: null };
    }

    if (t.isStringLiteral(attr.value)) {
        return { kind: 'static', value: attr.value.value };
    }

    return {
        kind: 'unsupported',
        value: generate(attr.value).code,
        reason: 'Only static string className values are supported in V1',
    };
}

function getTagName(name: T.JSXOpeningElement['name']): string {
    if (t.isJSXIdentifier(name)) {
        return name.name;
    }
    if (t.isJSXMemberExpression(name)) {
        return generate(name).code;
    }
    return 'unknown';
}

function findComponentName(path: NodePath<T.JSXOpeningElement>): string | null {
    const fn = path.findParent((parent) => {
        return (
            parent.isFunctionDeclaration() ||
            parent.isFunctionExpression() ||
            parent.isArrowFunctionExpression()
        );
    });

    if (!fn) {
        return null;
    }

    if (fn.isFunctionDeclaration() && fn.node.id?.name) {
        return fn.node.id.name;
    }

    const parent = fn.parentPath;
    if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
        return parent.node.id.name;
    }

    return null;
}
