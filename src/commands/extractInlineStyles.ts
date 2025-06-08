import * as vscode from 'vscode';
import { parseInlineStyles, convertToCSS } from '../utils/styleParser';

export function extractInlineStyles() {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor found.');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText) {
        vscode.window.showErrorMessage('No text selected.');
        return;
    }

    const inlineStyles = parseInlineStyles(selectedText);
    const cssStyles = convertToCSS(inlineStyles);

    vscode.env.clipboard.writeText(cssStyles).then(() => {
        vscode.window.showInformationMessage('Inline styles extracted and copied to clipboard as CSS.');
    }, (err) => {
        vscode.window.showErrorMessage('Failed to copy styles to clipboard: ' + err);
    });
}