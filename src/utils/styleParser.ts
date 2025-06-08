import { StyleObject } from '../types';

export function parseInlineStyles(inlineStyle: string): StyleObject {
    const styles: StyleObject = {};

    let objText = inlineStyle.trim();

    // Try to extract style={{ ... }} or style="..." from anywhere in the string
    let jsxMatch = objText.match(/style\s*=\s*\{\{([\s\S]*?)\}\}/m);
    let htmlMatch = objText.match(/style\s*=\s*["']([^"']*)["']/m);

    if (jsxMatch) {
        objText = jsxMatch[1];
    } else if (htmlMatch) {
        // fallback to CSS string style
        htmlMatch[1].split(';').forEach(pair => {
            const [property, value] = pair.split(':').map(item => item.trim());
            if (property && value) {
                styles[property] = value;
            }
        });
        return styles;
    }

    // If selection is just the inner object (no braces), add them
    if (objText && !objText.trim().startsWith('{')) {
        objText = `{${objText}}`;
    }

    // Try to detect JSX object style: {color: "red", backgroundColor: "blue"}
    if (/^\s*\{[\s\S]*\}\s*$/.test(objText)) {
        // Remove newlines and trailing commas
        objText = objText.replace(/[\r\n]+/g, ' ');
        objText = objText.replace(/,\s*([}\]])/g, '$1');
        // Replace single quotes with double quotes for JSON.parse
        objText = objText.replace(/'/g, '"');
        // Add quotes to keys if missing (only if not already quoted)
        objText = objText.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');
        try {
            const parsed = JSON.parse(objText);
            Object.assign(styles, parsed);
            return styles;
        } catch (e) {
            return {};
        }
    }

    return styles;
}

// Pure regex camelCase to kebab-case
function camelToKebab(str: string): string {
    return str.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

export function convertToCSS(styles: StyleObject): string {
    return Object.entries(styles)
        .map(([property, value]) => `${camelToKebab(property)}: ${value};`)
        .join('\n');
}