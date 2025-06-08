import * as vscode from 'vscode';
import { parseInlineStyles, convertToCSS } from './utils/styleParser';

function provideCodeActions<T>(
    document: vscode.TextDocument, range: vscode.Range | vscode.Selection
): vscode.ProviderResult<(vscode.CodeAction | T)[]> {
    const selectedText = document.getText(range);
    const lineText = document.lineAt(range.start.line).text;
    let targetText = selectedText.trim() || lineText;

    // If selection is empty, try to get the full tag at the cursor (multi-line support)
    if (!selectedText.trim()) {
        // Find the start of the tag
        let tagStart = range.start.line;
        while (tagStart > 0 && !document.lineAt(tagStart).text.includes('<')) {
            tagStart--;
        }
        // Find the end of the tag
        let tagEnd = range.end.line;
        while (
            tagEnd < document.lineCount &&
            !document.lineAt(tagEnd).text.includes('>')
        ) {
            tagEnd++;
        }
        const tagRange = new vscode.Range(
            new vscode.Position(tagStart, 0),
            new vscode.Position(tagEnd, document.lineAt(tagEnd).text.length)
        );
        targetText = document.getText(tagRange);
    }

    if (
        /style\s*=\s*["'][^"']+["']/.test(targetText) ||
        /style\s*=\s*\{\{[\s\S]*?\}\}/.test(targetText)
    ) {
        const action = new vscode.CodeAction(
            'Extract Inline Styles',
            vscode.CodeActionKind.QuickFix
        );
        action.command = {
            command: 'extension.extractInlineStyles',
            title: 'Extract Inline Styles',
            arguments: []
        };
        return [action];
    }
    return [];
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider(
            [
                { language: 'html' },
                { language: 'javascriptreact' },
                { language: 'typescriptreact' }
            ],
            { provideCodeActions },
            {
                providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.extractInlineStyles', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor found.');
                return;
            }
            const document = editor.document;
            const selection = editor.selection;

            // Always extract the full tag at the cursor (multi-line support)
            let tagStart = selection.start.line;
            while (tagStart > 0 && !document.lineAt(tagStart).text.includes('<')) {
                tagStart--;
            }
            let tagEnd = selection.end.line;
            while (
                tagEnd < document.lineCount &&
                !document.lineAt(tagEnd).text.includes('>')
            ) {
                tagEnd++;
            }
            const tagRange = new vscode.Range(
                new vscode.Position(tagStart, 0),
                new vscode.Position(tagEnd, document.lineAt(tagEnd).text.length)
            );
            let tagText = document.getText(tagRange);

            let styles = parseInlineStyles(tagText);
            let css = convertToCSS(styles);

            if (!css || css.trim() === '') {
                await vscode.window.showErrorMessage('No valid styles found.');
                return;
            }

            await vscode.env.clipboard.writeText(css);

            // Remove the style attribute (works for both JSX and HTML)
            const htmlStyleRegex = /(\s*)style\s*=\s*(['"])[^'"]*\2(\s*)/m;
            const jsxStyleRegex = /(\s*)style\s*=\s*\{\{[\s\S]*?\}\}(\s*)/m;
            let edit: vscode.WorkspaceEdit | null = null;

            if (jsxStyleRegex.test(tagText)) {
                edit = new vscode.WorkspaceEdit();
                const newTagText = tagText.replace(jsxStyleRegex, ' ');
                edit.replace(document.uri, tagRange, newTagText);
                await vscode.workspace.applyEdit(edit);
            } else if (htmlStyleRegex.test(tagText)) {
                edit = new vscode.WorkspaceEdit();
                const newTagText = tagText.replace(htmlStyleRegex, ' ');
                edit.replace(document.uri, tagRange, newTagText);
                await vscode.workspace.applyEdit(edit);
            }
        })
    );
}

export function deactivate() {}