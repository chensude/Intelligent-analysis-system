document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const questionsContainer = document.getElementById('questionsContainer');
    const questionTypeSelect = document.getElementById('questionType');

    // 拖拽上传
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#2196F3';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        const files = e.dataTransfer.files;
        handleFile(files[0]);
    });

    fileInput.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (file.type.includes('word') || file.type.includes('document')) {
            handleWord(file);
        }
    }

    function handleWord(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            mammoth.extractRawText({arrayBuffer: e.target.result})
                .then(result => {
                    const text = result.value;
                    parseQuestions(text);
                });
        };
        reader.readAsArrayBuffer(file);
    }

    function parseQuestions(text) {
        questionsContainer.innerHTML = '';
        
        // 移除文档标题（第一行）
        const lines = text.split('\n');
        const contentLines = lines.slice(1).join('\n'); // 跳过第一行
        
        // 使用正则表达式匹配题目
        const questionMatches = contentLines.match(/\d+、[^]*?(?=\d+、|$)/g) || [];
        
        // 处理每个题目
        questionMatches.forEach((questionText, index) => {
            const questionObj = parseQuestion(questionText);
            if (questionObj) {
                displayQuestion(questionObj, index + 1);
            }
        });
    }

    function parseQuestion(questionText) {
        const lines = questionText.split('\n').filter(line => line.trim());
        if (lines.length < 1) return null;

        const questionTitle = lines[0].trim();
        const options = [];
        let correctAnswer = '';
        let questionType = 'essay'; // 默认为简答题

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 处理选择题选项
            if (line.startsWith('A') || line.startsWith('B') || 
                line.startsWith('C') || line.startsWith('D')) {
                options.push(line);
                // 根据选项数量判断题型
                if (options.length >= 4) {
                    questionType = 'single'; // 默认为单选题
                }
            }
            // 处理正确答案标记
            else if (line.includes('正确答案：')) {
                correctAnswer = line.split('：')[1].trim();
                // 如果正确答案包含多个选项，则为多选题
                if (correctAnswer.length > 1 && options.length > 0) {
                    questionType = 'multiple';
                }
            }
            // 处理答案内容（针对简答题）
            else if (!line.startsWith('A') && !line.startsWith('B') && 
                    !line.startsWith('C') && !line.startsWith('D') && 
                    line.length > 0 && !line.includes('一、')) {
                if (correctAnswer === '') {
                    correctAnswer = line;
                } else {
                    correctAnswer += '\n' + line;
                }
            }
        }

        // 如果没有实际内容，返回null
        if (!questionTitle || (options.length === 0 && !correctAnswer)) {
            return null;
        }

        return {
            type: questionType,
            title: questionTitle,
            options: options,
            correctAnswer: correctAnswer
        };
    }

    function displayQuestion(question, index) {
        const questionCard = document.createElement('div');
        questionCard.className = 'question-card';
        questionCard.dataset.type = question.type; // 添加题型数据属性
        
        const typeText = {
            'single': '单选题',
            'multiple': '多选题',
            'essay': '简答题'
        }[question.type] || '其他题型';

        questionCard.innerHTML = `
            <div class="question-content">
                <div class="question-type">${typeText}</div>
                <div class="question-title">${index}、${question.title}</div>
                ${question.options.length ? `
                    <div class="options">
                        ${question.options.map(option => `<div class="option">${option}</div>`).join('')}
                    </div>
                ` : ''}
                <div class="answer-section">
                    <div class="correct-answer">答案：${question.correctAnswer.replace(/\n/g, '<br>')}</div>
                </div>
            </div>
        `;
        
        questionsContainer.appendChild(questionCard);
    }

    // 题型筛选功能
    questionTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;
        const questions = document.querySelectorAll('.question-card');
        
        questions.forEach(question => {
            if (selectedType === 'all' || question.dataset.type === selectedType) {
                question.style.display = 'block';
            } else {
                question.style.display = 'none';
            }
        });
    });
}); 