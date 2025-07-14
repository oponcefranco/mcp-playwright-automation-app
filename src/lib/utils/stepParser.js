// lib/utils/stepParser.js

class StepParser {
    constructor() {
        this.patterns = [
            // Navigation patterns
            {
                regex: /(?:navigate|go|visit)\s+(?:to\s+)?(.+)/i,
                action: 'navigate',
                target: 1
            },

            // Click patterns
            {
                regex: /click\s+(?:on\s+)?(?:the\s+)?(.+)/i,
                action: 'click',
                target: 1
            },

            // Type/Fill patterns
            {
                regex: /(?:type|enter|fill)\s+['"]([^'"]+)['"]?\s+(?:in|into|to)\s+(?:the\s+)?(.+)/i,
                action: 'fill',
                value: 1,
                target: 2
            },
            {
                regex: /(?:enter|type)\s+(.+)\s+(?:in|into|to)\s+(?:the\s+)?(.+)/i,
                action: 'fill',
                value: 1,
                target: 2
            },

            // Select patterns
            {
                regex: /select\s+['"]?([^'"]+)['"]?\s+(?:from|in)\s+(?:the\s+)?(.+)/i,
                action: 'select',
                value: 1,
                target: 2
            },

            // Wait patterns
            {
                regex: /wait\s+(?:for\s+)?(\d+)\s*(?:ms|milliseconds?|seconds?)?/i,
                action: 'wait',
                value: 1
            },
            {
                regex: /wait\s+(?:for\s+)?(?:the\s+)?(.+?)\s+(?:to\s+(?:be\s+)?(?:visible|appear|load))/i,
                action: 'wait',
                target: 'element',
                value: 1
            },

            // Verification patterns
            {
                regex: /(?:verify|check|assert)\s+(?:that\s+)?(?:the\s+)?(.+?)\s+(?:is\s+)?(?:visible|displayed|shown)/i,
                action: 'verify',
                target: 1,
                assertion: 'visible'
            },
            {
                regex: /(?:verify|check|assert)\s+(?:that\s+)?(?:the\s+)?(.+?)\s+(?:contains?|has)\s+['"]([^'"]+)['"]?/i,
                action: 'verify',
                target: 1,
                value: 2,
                assertion: 'text'
            },
            {
                regex: /(?:verify|check|assert)\s+(?:that\s+)?(?:the\s+)?(.+)/i,
                action: 'verify',
                target: 1
            },

            // Hover patterns
            {
                regex: /hover\s+(?:over\s+)?(?:the\s+)?(.+)/i,
                action: 'hover',
                target: 1
            },

            // Key press patterns
            {
                regex: /press\s+(?:the\s+)?(.+?)\s+key/i,
                action: 'press',
                value: 1
            },

            // Screenshot pattern
            {
                regex: /take\s+(?:a\s+)?screenshot/i,
                action: 'screenshot'
            }
        ];
    }

    async parse(instructions) {
        if (!instructions || !instructions.trim()) {
            return [];
        }

        const lines = instructions
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line.replace(/^\d+\.\s*/, '')); // Remove step numbers

        const steps = [];

        for (const line of lines) {
            const step = this.parseLine(line);
            if (step) {
                steps.push(step);
            }
        }

        return this.validateSteps(steps);
    }

    parseLine(line) {
        for (const pattern of this.patterns) {
            const match = line.match(pattern.regex);
            if (match) {
                const step = {
                    action: pattern.action,
                    original: line
                };

                if (pattern.target) {
                    step.target = typeof pattern.target === 'number'
                        ? match[pattern.target]?.trim()
                        : pattern.target;
                }

                if (pattern.value) {
                    step.value = typeof pattern.value === 'number'
                        ? match[pattern.value]?.trim()
                        : pattern.value;
                }

                if (pattern.assertion) {
                    step.assertion = typeof pattern.assertion === 'number'
                        ? match[pattern.assertion]?.trim()
                        : pattern.assertion;
                }

                return this.cleanStep(step);
            }
        }

        // If no pattern matches, create a generic step
        return {
            action: 'custom',
            target: line,
            original: line
        };
    }

    cleanStep(step) {
        // Clean up common words and phrases
        if (step.target) {
            step.target = step.target
                .replace(/^the\s+/i, '')
                .replace(/\s+field$/i, '')
                .replace(/\s+element$/i, '')
                .replace(/\s+button$/i, ' button')
                .trim();
        }

        if (step.value) {
            step.value = step.value
                .replace(/^['"]|['"]$/g, '') // Remove quotes
                .trim();
        }

        return step;
    }

    validateSteps(steps) {
        const validated = [];

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const enhancedStep = this.enhanceStep(step, i, steps);
            validated.push(enhancedStep);
        }

        return validated;
    }

    enhanceStep(step, index, allSteps) {
        const enhanced = { ...step, stepNumber: index + 1 };

        // Add implicit waits for better reliability
        if (step.action === 'click' || step.action === 'fill') {
            enhanced.waitBefore = true;
        }

        // Enhance selectors based on context
        if (step.target && step.target.includes('login')) {
            enhanced.context = 'authentication';
        }

        // Add error handling suggestions
        if (step.action === 'verify' && !step.assertion) {
            enhanced.assertion = 'visible';
        }

        return enhanced;
    }
}

export const stepParser = new StepParser();