import { EditorAttributes } from '@onlook/constants';
import { getAstFromContent } from '../parse';
import type { T } from '../packages';
import { generate, t, traverse } from '../packages';
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
                path.node.attributes.push(
                    t.jsxAttribute(
                        t.jsxIdentifier('className'),
                        t.stringLiteral(input.nextClassName),
                    ),
                );
                path.stop();
                return;
            }

            if (!attr.value || !t.isStringLiteral(attr.value)) {
                throw new Error('Only static string className values are supported in V1');
            }

            attr.value = t.stringLiteral(input.nextClassName);
            path.stop();
        },
    });

    if (!found) {
        throw new Error(`No JSX element found for oid ${input.oid}`);
    }

    const after = generate(ast).code;

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
