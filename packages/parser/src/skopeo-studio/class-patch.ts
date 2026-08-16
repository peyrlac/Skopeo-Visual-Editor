import { EditorAttributes } from '@onlook/constants';
import { getAstFromContent } from '../parse';
import type { T } from '../packages';
import { t, traverse } from '../packages';
import { createUnifiedDiff } from './diff';

export type StudioPatchPreview = {
    filePath: string;
    oid: string;
    before: string;
    after: string;
    diff: string;
};

export function previewClassNamePatchInFile(input: {
    filePath: string;
    content: string;
    oid: string;
    nextClassName: string;
}): StudioPatchPreview {
    const ast = getAstFromContent(input.content);
    if (!ast) {
        throw new Error(`Could not parse ${input.filePath}`);
    }

    let found = false;
    let after: string | null = null;

    traverse(ast, {
        JSXOpeningElement(path) {
            const oid = getStringAttribute(path.node, EditorAttributes.DATA_ONLOOK_ID);
            if (oid !== input.oid) {
                return;
            }

            found = true;
            const attr = path.node.attributes.find(
                (attribute) =>
                    t.isJSXAttribute(attribute) && attribute.name.name === 'className',
            );

            if (!attr || !t.isJSXAttribute(attr)) {
                throw new Error(`No static className found for oid ${input.oid}`);
            }

            if (!attr.value || !t.isStringLiteral(attr.value)) {
                throw new Error('Only static string className values are supported in V1');
            }

            after = replaceStringLiteralValue(input.content, attr.value, input.nextClassName);
            path.stop();
        },
    });

    if (!found) {
        throw new Error(`No JSX element found for oid ${input.oid}`);
    }

    if (after === null) {
        throw new Error(`No static className found for oid ${input.oid}`);
    }

    return {
        filePath: input.filePath,
        oid: input.oid,
        before: input.content,
        after,
        diff: createUnifiedDiff(input.filePath, input.content, after),
    };
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

function replaceStringLiteralValue(
    content: string,
    value: T.StringLiteral,
    nextValue: string,
): string {
    if (typeof value.start !== 'number' || typeof value.end !== 'number') {
        throw new Error('Could not locate static className value');
    }

    const quote = content[value.start];
    if ((quote !== '"' && quote !== "'") || content[value.end - 1] !== quote) {
        throw new Error('Could not locate static className value');
    }

    return `${content.slice(0, value.start + 1)}${nextValue}${content.slice(value.end - 1)}`;
}
