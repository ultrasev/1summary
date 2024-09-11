import { PROMPT as DEFAULT_PROMPT } from './config.js';

export function llm(content, onChunk) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['appKey', 'apiUrl', 'model', 'prompt', 'temperature'], async function (result) {
            const appKey = result.appKey;
            const apiUrl = result.apiUrl;
            const model = result.model;
            const prompt = result.prompt || DEFAULT_PROMPT;
            const temperature = parseFloat(result.temperature) || 0.7;

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${appKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: prompt },
                            { role: "user", content: content }
                        ],
                        temperature: temperature,
                        stream: true
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        break;
                    }
                    const chunk = decoder.decode(value);
                    const lines = chunk.split("\n");
                    const parsedLines = lines
                        .map(line => line.replace(/^data: /, "").trim())
                        .filter(line => line !== "" && line !== "[DONE]")
                        .map(line => {
                            try {
                                return JSON.parse(line);
                            } catch (error) {
                                return {
                                    choices: [
                                        {
                                            delta: {
                                                content: line
                                            }
                                        }
                                    ]
                                };
                            }
                        })
                        .filter(line => line !== null);

                    for (const parsedLine of parsedLines) {
                        const { choices } = parsedLine;
                        const { delta } = choices[0];
                        const { content } = delta;
                        if (content) {
                            onChunk(content);
                        }
                    }
                }
                resolve();
            } catch (error) {
                console.error('Error in llm calling:', error);
                reject(error);
            }
        });
    });
}


export async function testLLMConnection() {
    try {
        const settings = await new Promise((resolve) => {
            chrome.storage.sync.get(['appKey', 'apiUrl', 'model'], resolve);
        });

        const { appKey, apiUrl, model } = settings;

        if (!appKey || !apiUrl || !model) {
            throw new Error('Missing required settings: API Key, API URL, or Model');
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${appKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "Hello" }],
                max_tokens: 5
            })
        });

        const responseData = await response.text();
        const details = {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData
        };

        if (!response.ok) {
            throw {
                message: `API request failed: ${response.statusText}`,
                details: details
            };
        }

        return { success: true, details: details };
    } catch (error) {
        return {
            error: error.message || 'An unknown error occurred',
            details: error.details || error
        };
    }
}