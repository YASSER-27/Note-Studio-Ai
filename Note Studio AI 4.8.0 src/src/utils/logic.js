/**
 * محرك المنطق (Logic.js) - تم إصلاحه ليعمل في المتصفح
 */

export const Logic = {
    stopTokens: [
        '</s>', '<|eot_id|>', '<|im_end|>', '<|end_of_turn|>', 
        '<end_of_turn>', '<|endoftext|>', '<|return|>'
    ],

    parseResponse: (text) => {
        const thinkingMatch = text.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
        const thinking = thinkingMatch ? thinkingMatch[1].trim() : null;
        const content = text.replace(/<think>([\s\S]*?)(?:<\/think>|$)/g, '').trim();
        
        return { thinking, content };
    },

    getFormattedPrompt: (messages, modelName) => {
        const name = (modelName || "").toLowerCase();
        const isLlama3 = name.includes('llama-3') || name.includes('meta');
        
        const formatted = messages.map(msg => {
            const role = msg.role === 'user' ? 'user' : 'assistant';
            if (isLlama3) {
                return `<|start_header_id|>${role}<|end_header_id|>\n\n${msg.text}<|eot_id|>`;
            }
            return `<|im_start|>${role}\n${msg.text}<|im_end|>\n`;
        }).join("");

        return formatted + (isLlama3 ? `<|start_header_id|>assistant<|end_header_id|>\n\n` : `<|im_start|>assistant\n`);
    },

    // تعديل هذه الدالة لاستقبال معلومات العتاد بدلاً من محاولة جلبها بنفسها
    getHardwareAdvice: (systemSpecs) => {
        // إذا لم تتوفر معلومات، استخدم قيم افتراضية آمنة
        const cpuCores = systemSpecs?.cores || 4;
        const totalRamGB = systemSpecs?.ram || 8;
        
        const threads = cpuCores <= 4 ? cpuCores : Math.floor(cpuCores * 0.8);
        const isHighEnd = totalRamGB >= 8 && cpuCores >= 6;

        return {
            threads,
            gpuLayers: isHighEnd ? 35 : 0,
            isHighEnd
        };
    },

    defaultParams: {
        temperature: 0.7,
        min_p: 0.05,
        n_predict: 2048,
    }
};