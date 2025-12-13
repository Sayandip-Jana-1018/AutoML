
declare global {
    interface Window {
        loadPyodide: (config?: any) => Promise<any>;
    }
}

let pyodideInstance: any = null;

// Initialize Pyodide and load required packages
export async function initPyodide() {
    if (pyodideInstance) return pyodideInstance;

    console.log('[Pyodide] Initializing...');

    if (!window.loadPyodide) {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Pyodide script'));
            document.head.appendChild(script);
        });
    }

    pyodideInstance = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
        stdout: (text: string) => console.log('[Python stdout]', text),
        stderr: (text: string) => console.warn('[Python stderr]', text),
    });

    console.log('[Pyodide] Loaded. Installing packages...');
    // Load packages needed for data viz
    // Load base packages
    await pyodideInstance.loadPackage(['matplotlib', 'pandas', 'numpy', 'pytz', 'scipy', 'micropip', 'scikit-learn']);

    // Install seaborn and plotly via micropip
    const micropip = pyodideInstance.pyimport("micropip");
    await micropip.install(['seaborn', 'plotly']);

    console.log('[Pyodide] Packages installed.');

    return pyodideInstance;
}

// Queue to sequentialize Pyodide executions to prevent race conditions
let executionQueue: Promise<any> = Promise.resolve();

// Execute Python code and return the generated plot as JSON string
export async function runClientSidePython(code: string, csvData?: string): Promise<{ plotData?: string, error?: string, logs: string[] }> {
    // Chain execution to the queue
    const task = async () => {
        const logs: string[] = [];
        try {
            const py = await initPyodide();

            // Capture output
            py.setStdout({ batched: (msg: string) => logs.push(msg) });
            py.setStderr({ batched: (msg: string) => logs.push(`Error: ${msg}`) });

            // If CSV data provided, write it to file system
            if (csvData) {
                py.FS.writeFile('data.csv', csvData);
                py.FS.writeFile('dataset.csv', csvData);
            }

            // Wrap code to capture Plotly figure
            const wrappedCode = `
import pandas as pd
import numpy as np
import scipy
import json
import plotly
import plotly.express as px
import plotly.graph_objects as go
import plotly.io as pio

# Capture fig.show()
_last_fig = None
def _custom_show(self, *args, **kwargs):
    global _last_fig
    _last_fig = self

# Monkey patch show
plotly.graph_objects.Figure.show = _custom_show

# User Code
${code}

# Extract JSON
result_json = None
if _last_fig:
    result_json = _last_fig.to_json()
elif 'fig' in locals() and hasattr(locals()['fig'], 'to_json'):
    result_json = locals()['fig'].to_json()
elif 'fig' in globals() and hasattr(globals()['fig'], 'to_json'):
    result_json = globals()['fig'].to_json()

result_json
`;

            const result = await py.runPythonAsync(wrappedCode);

            if (result) {
                return { plotData: result, logs };
            } else {
                return { error: 'No plot generated. Ensure you assign your figure to "fig" or call fig.show().', logs };
            }

        } catch (err: any) {
            console.error('[Pyodide] Execution Failed:', err);
            return { error: err.message || String(err), logs };
        }
    };

    // Append to queue
    const resultPromise = executionQueue.then(task);

    // Ensure queue continues even if task fails
    executionQueue = resultPromise.catch(() => { });

    return resultPromise;
}
