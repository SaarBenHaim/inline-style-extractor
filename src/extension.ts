import * as vscode from 'vscode';
import { parseInlineStyles, convertToCSS } from './utils/styleParser';

function findTagRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | null {
    let tagStart = position.line;
    while (tagStart > 0 && !document.lineAt(tagStart).text.includes('<')) {
        tagStart--;
    }
    let tagEnd = position.line;
    while (
        tagEnd < document.lineCount - 1 && 
        !document.lineAt(tagEnd).text.includes('>')
    ) {
        tagEnd++;
    }
    if (tagStart <= tagEnd) {
        return new vscode.Range(
            new vscode.Position(tagStart, 0),
            new vscode.Position(tagEnd, document.lineAt(tagEnd).text.length)
        );
    }
    return null;
}

function getTagText(document: vscode.TextDocument, position: vscode.Position): { tagText: string, tagRange: vscode.Range | null } {
    const tagRange = findTagRange(document, position);
    if (tagRange) {
        return { tagText: document.getText(tagRange), tagRange };
    }
    return { tagText: '', tagRange: null };
}

function removeInlineStyleFromTag(tagText: string): { newTagText: string, styleText: string } {
    // Remove style attribute and capture its value
    let styleMatch = tagText.match(/style\s*=\s*(\{\{[\s\S]*?\}\}|{[\s\S]*?}|["'][^"']*["'])/m);
    if (!styleMatch) return { newTagText: tagText, styleText: '' };
    let styleText = styleMatch[1].trim();

    // Remove wrapping quotes if present
    if (
        (styleText.startsWith('"') && styleText.endsWith('"')) ||
        (styleText.startsWith("'") && styleText.endsWith("'"))
    ) {
        styleText = styleText.slice(1, -1).trim();
    }

    // If styleText is wrapped with double curly braces, unwrap to single
    while (
        styleText.startsWith('{') && styleText.endsWith('}') &&
        styleText.slice(1, -1).trim().startsWith('{') &&
        styleText.slice(1, -1).trim().endsWith('}')
    ) {
        styleText = styleText.slice(1, -1).trim();
    }

    const newTagText = tagText.replace(styleMatch[0], '').replace(/\s{2,}/g, ' ');
    return { newTagText, styleText };
}

async function extractInlineStylesToClipboard(document: vscode.TextDocument, selection: vscode.Selection) {
    const { tagText, tagRange } = getTagText(document, selection.active);
    if (!tagText || !tagRange) return;

    const { newTagText, styleText } = removeInlineStyleFromTag(tagText);
    if (!styleText) {
        vscode.window.showWarningMessage('No inline style found in this tag.');
        return;
    }

    const styles = parseInlineStyles(styleText);
    const css = convertToCSS(styles);

    // Copy as anonymous CSS class (no name)
    const classCss = `{\n${css}\n}`;

    // Edit document: remove inline style
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, tagRange, newTagText);
    await vscode.workspace.applyEdit(edit);

    await vscode.env.clipboard.writeText(classCss);
}

async function extractInlineStylesAsClass(document: vscode.TextDocument, selection: vscode.Selection) {
    const { tagText, tagRange } = getTagText(document, selection.active);
    if (!tagText || !tagRange) return;

    const { newTagText, styleText } = removeInlineStyleFromTag(tagText);
    if (!styleText) {
        vscode.window.showWarningMessage('No inline style found in this tag.');
        return;
    }

    const styles = parseInlineStyles(styleText);
    const css = convertToCSS(styles);

    // Extract existing className value if present
    const classNameMatch = newTagText.match(/class(Name)?=["']([^"']+)["']/);
    const existingClassName = classNameMatch ? classNameMatch[2].split(/\s+/)[0] : '';

    const className = await vscode.window.showInputBox({
        prompt: 'Enter CSS class name',
        placeHolder: 'my-class',
        value: existingClassName
    });

    if (className) {
        const classCss = `.${className} {\n${css}\n}`;
        let updatedTag: string;

        if (classNameMatch) {
            // Replace the entire className attribute with the new className (no duplication)
            updatedTag = newTagText.replace(/class(Name)?=["'][^"']*["']/, `class${classNameMatch[1] || ''}="${className}"`);
        } else {
            // Add className attribute if it doesn't exist
            updatedTag = newTagText.replace(/<([a-zA-Z0-9]+)/, `<$1 className="${className}"`);
        }

        // Edit document: replace tag with updatedTag
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, tagRange, updatedTag);
        await vscode.workspace.applyEdit(edit);

        await vscode.env.clipboard.writeText(classCss);
    }
}

function provideCodeActions(
    document: vscode.TextDocument, range: vscode.Range | vscode.Selection
): vscode.ProviderResult<vscode.CodeAction[]> {
    const { tagText } = getTagText(document, range.start);
    if (
        /style\s*=\s*["'][^"']+["']/.test(tagText) ||
        /style\s*=\s*\{\{[\s\S]*?\}\}/.test(tagText)
    ) {
        const action1 = new vscode.CodeAction(
            'Copy Inline Styles as CSS',
            vscode.CodeActionKind.QuickFix
        );
        action1.command = { command: 'extension.extractInlineStyles', title: 'Copy Inline Styles as CSS' };
        action1.kind = vscode.CodeActionKind.QuickFix;

        const action2 = new vscode.CodeAction(
            'Copy Inline Styles as CSS Class',
            vscode.CodeActionKind.QuickFix
        );
        action2.command = { command: 'extension.extractInlineStylesAsClass', title: 'Copy Inline Styles as CSS Class' };
        action2.kind = vscode.CodeActionKind.QuickFix;

        return [action1, action2];
    }
    return [];
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.extractInlineStyles', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            await extractInlineStylesToClipboard(editor.document, editor.selection);
        }),
        vscode.commands.registerCommand('extension.extractInlineStylesAsClass', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) { return; }
            await extractInlineStylesAsClass(editor.document, editor.selection);
        }),
        vscode.languages.registerCodeActionsProvider(
            ['javascriptreact', 'typescriptreact', 'html'],
            { provideCodeActions }
        )
    );
}

export function deactivate() {}