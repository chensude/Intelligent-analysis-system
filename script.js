// 全局变量
let currentQuestion = null;
let currentQuestionIndex = 0;
let questions = []; // 存储所有题目
let currentFilterType = 'all';

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
        // 清除之前的数据
        questions = [];
        currentQuestionIndex = 0;
        currentFilterType = 'all';
        questionsContainer.innerHTML = '';
        
        // 修改文件类型判断逻辑
        const wordTypes = [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
            'application/msword', // .doc
            'application/vnd.ms-word.document.12' // 新版 Word
        ];
        
        if (wordTypes.includes(file.type)) {
            handleWord(file);
        } else {
            alert('请上传Word文档格式的文件（.doc 或 .docx）');
        }
    }

    function handleWord(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            mammoth.extractRawText({arrayBuffer: e.target.result})
                .then(result => {
                    const text = result.value;
                    console.log('提取的文本内容:', text); // 添加调试日志
                    parseQuestions(text);
                })
                .catch(error => {
                    console.error('解析文件时出错:', error);
                    alert('解析文件时出错，请确保文件格式正确');
                });
        };
        
        reader.onerror = function(error) {
            console.error('读取文件时出错:', error);
            alert('读取文件时出错，请重试');
        };
        
        reader.readAsArrayBuffer(file);
    }

    function parseQuestions(text) {
        // 清除之前的数据
        questions = [];
        currentQuestionIndex = 0;
        questionsContainer.innerHTML = '';
        
        // 移除文档标题（第一行）
        const lines = text.split('\n').filter(line => line.trim());
        
        // 使用更精确的正则表达式匹配题号
        const questionPattern = /(\d+)[、.．]\s*/;
        const questionMatches = [];
        let currentQuestion = '';
        let currentNumber = 0;
        
        // 遍历每一行
        lines.forEach(line => {
            const match = line.match(questionPattern);
            if (match) {
                const number = parseInt(match[1]);
                // 如果是新题目（题号大于当前题号）
                if (number > currentNumber) {
                    if (currentQuestion) {
                        questionMatches.push(currentQuestion);
                    }
                    currentQuestion = line;
                    currentNumber = number;
                } else {
                    // 如果是当前题目的一部分
                    currentQuestion += '\n' + line;
                }
            } else if (currentQuestion) {
                // 不是题号开头的行，添加到当前题目
                currentQuestion += '\n' + line;
            }
        });
        
        // 添加最后一个题目
        if (currentQuestion) {
            questionMatches.push(currentQuestion);
        }
        
        console.log('找到的题目数量:', questionMatches.length);
        
        // 存储解析后的题目
        questions = questionMatches
            .map((questionText, index) => {
                const parsedQuestion = parseQuestion(questionText.trim());
                console.log(`第${index + 1}题解析结果:`, parsedQuestion);
                return parsedQuestion;
            })
            .filter(q => q !== null);
        
        // 只显示第一题
        if (questions.length > 0) {
            currentQuestionIndex = 0;
            displayQuestion(questions[0], 0);
        } else {
            questionsContainer.innerHTML = '<div class="error-message">未能识别到任何题目，请检查文档格式</div>';
        }
    }

    // 修改解析单个题目的函数
    function parseQuestion(questionText) {
        const lines = questionText.split('\n').filter(line => line.trim());
        if (lines.length < 1) return null;

        // 提取题号和标题
        const titleMatch = lines[0].match(/(\d+)[、.．]\s*(.+)/);
        if (!titleMatch) return null;

        const questionNumber = parseInt(titleMatch[1]); // 保存题号
        const questionTitle = titleMatch[2].trim(); // 只保存题目内容，不包含题号
        
        const options = [];
        let correctAnswer = '';
        let questionType = 'essay';

        // 遍历每一行寻找选项和答案
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 匹配选项（支持更多格式）
            const optionMatch = line.match(/^([A-D])[.、）\s)\.](.+)/i);
            if (optionMatch) {
                options.push(line);
                if (options.length >= 2) {
                    questionType = 'single';
                }
            }
            // 匹配答案标记
            else if (line.match(/^(答案|正确答案|参考答案)[：:]/i)) {
                const answerContent = line.split(/[：:]/)[1].trim();
                if (answerContent) {
                    // 检查是否为多选题答案（包含多个字母）
                    const multipleAnswerMatch = answerContent.match(/[A-D]{2,}/i);
                    if (multipleAnswerMatch && options.length > 0) {
                        correctAnswer = multipleAnswerMatch[0].toUpperCase();
                        questionType = 'multiple';
                    } else {
                        // 单选题答案
                        const singleAnswerMatch = answerContent.match(/[A-D]/i);
                        if (singleAnswerMatch) {
                            correctAnswer = singleAnswerMatch[0].toUpperCase();
                            questionType = 'single';
                        } else {
                            // 简答题答案
                            correctAnswer = answerContent;
                            questionType = 'essay';
                        }
                    }
                }
            }
        }

        // 如果没有找到答案但有选项，默认为单选题
        if (!correctAnswer && options.length >= 2) {
            questionType = 'single';
        }

        console.log('题目解析:', {
            title: questionTitle,
            type: questionType,
            options: options,
            correctAnswer: correctAnswer
        });

        return {
            number: questionNumber,
            type: questionType,
            title: questionTitle, // 只保存题目内容
            options: options,
            correctAnswer: correctAnswer
        };
    }

    function displayQuestion(question, index) {
        const questionsContainer = document.getElementById('questionsContainer');
        questionsContainer.innerHTML = '';
        
        const questionCard = document.createElement('div');
        questionCard.className = 'question-card';
        questionCard.dataset.type = question.type;
        
        const typeText = {
            'single': '单选题',
            'multiple': '多选题',
            'essay': '简答题'
        }[question.type] || '其他题型';

        questionCard.innerHTML = `
            <div class="question-content">
                <div class="question-type">${typeText}</div>
                <div class="question-title">第 ${question.number} 题：${question.title}</div>
            </div>
        `;

        // 根据题型显示不同的交互元素
        if (question.type === 'essay') {
            // 简答题显示文本框和按钮
            const answerContainer = document.createElement('div');
            answerContainer.className = 'essay-answer-container';
            
            // 添加文本框
            const textarea = document.createElement('textarea');
            textarea.className = 'essay-input';
            textarea.placeholder = '请在此输入你的答案...';
            answerContainer.appendChild(textarea);
            
            // 添加查看答案按钮
            const viewAnswerButton = document.createElement('button');
            viewAnswerButton.textContent = '查看答案';
            viewAnswerButton.className = 'view-answer-button';
            viewAnswerButton.onclick = () => toggleAnswer(question.correctAnswer);
            
            // 添加按钮容器
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'essay-button-container';
            buttonContainer.appendChild(viewAnswerButton);
            answerContainer.appendChild(buttonContainer);
            
            // 添加答案显示区域（默认隐藏）
            const answerDisplay = document.createElement('div');
            answerDisplay.className = 'answer-display';
            answerDisplay.style.display = 'none';
            answerContainer.appendChild(answerDisplay);
            
            questionCard.appendChild(answerContainer);
        } else if (question.type === 'multiple') {
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-container';
            
            // 多选题使用复选框
            question.options.forEach((option) => {
                const label = document.createElement('label');
                label.className = 'option-label';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'option-checkbox';
                checkbox.value = option.match(/^[A-D]/i)[0];
                
                const span = document.createElement('span');
                span.textContent = option;
                
                label.appendChild(checkbox);
                label.appendChild(span);
                optionsContainer.appendChild(label);
            });
            
            // 添加确认按钮
            const confirmButton = document.createElement('button');
            confirmButton.textContent = '确认答案';
            confirmButton.className = 'confirm-button';
            confirmButton.onclick = () => checkMultipleAnswer(question.correctAnswer);
            optionsContainer.appendChild(confirmButton);
            
            questionCard.appendChild(optionsContainer);
        } else {
            // 单选题使用按钮
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-container';
            // 添加选项按钮
            question.options.forEach((option) => {
                const button = document.createElement('button');
                button.textContent = option;
                button.classList.add('option-button');
                button.onclick = () => checkAnswer(option, question.correctAnswer);
                optionsContainer.appendChild(button);
            });
            
            questionCard.appendChild(optionsContainer);
        }

        // 添加错误信息容器
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.style.display = 'none';
        questionCard.appendChild(errorMessage);
        
        // 添加导航按钮容器
        const navigationButtons = document.createElement('div');
        navigationButtons.className = 'navigation-buttons';
        
        // 添加上一题按钮
        const prevButton = document.createElement('button');
        prevButton.textContent = '上一题';
        prevButton.className = 'prev-button';
        prevButton.disabled = getPreviousQuestion() === -1;
        prevButton.onclick = () => {
            const prevIndex = getPreviousQuestion();
            if (prevIndex !== -1) {
                currentQuestionIndex = prevIndex;
                displayQuestion(questions[currentQuestionIndex], currentQuestionIndex);
            }
        };
        
        // 添加下一题按钮
        const nextButton = document.createElement('button');
        nextButton.textContent = '下一题';
        nextButton.className = 'next-button';
        nextButton.disabled = getNextQuestion() === -1;
        nextButton.onclick = () => {
            const nextIndex = getNextQuestion();
            if (nextIndex !== -1) {
                currentQuestionIndex = nextIndex;
                displayQuestion(questions[currentQuestionIndex], currentQuestionIndex);
            } else {
                questionsContainer.innerHTML = `
                    <div class="completion-message">
                        <h2>🎉 恭喜你，完成所有题目！</h2>
                    </div>
                `;
            }
        };
        
        navigationButtons.appendChild(prevButton);
        navigationButtons.appendChild(nextButton);
        questionCard.appendChild(navigationButtons);
        
        questionsContainer.appendChild(questionCard);
    }

    // 修改获取下一题的函数
    function getNextQuestion() {
        const currentNumber = questions[currentQuestionIndex].number;
        
        if (currentFilterType === 'all') {
            // 显示所有题型时，查找下一个题号
            for (let i = 0; i < questions.length; i++) {
                if (questions[i].number === currentNumber + 1) {
                    return i;
                }
            }
            return -1;
        } else {
            // 筛选特定题型时，查找下一个同类型的题目
            for (let i = 0; i < questions.length; i++) {
                if (questions[i].type === currentFilterType && 
                    questions[i].number > currentNumber) {
                    return i;
                }
            }
            return -1;
        }
    }

    // 修改获取上一题的函数
    function getPreviousQuestion() {
        const currentNumber = questions[currentQuestionIndex].number;
        
        if (currentFilterType === 'all') {
            // 显示所有题型时，查找上一个题号
            for (let i = questions.length - 1; i >= 0; i--) {
                if (questions[i].number === currentNumber - 1) {
                    return i;
                }
            }
            return -1;
        } else {
            // 筛选特定题型时，查找上一个同类型的题目
            for (let i = questions.length - 1; i >= 0; i--) {
                if (questions[i].type === currentFilterType && 
                    questions[i].number < currentNumber) {
                    return i;
                }
            }
            return -1;
        }
    }

    // 修改题型筛选功能
    questionTypeSelect.addEventListener('change', function() {
        const selectedType = this.value;
        currentFilterType = selectedType;
        
        if (selectedType !== 'all') {
            // 找到第一个符合类型的题目
            for (let i = 0; i < questions.length; i++) {
                if (questions[i].type === selectedType) {
                    currentQuestionIndex = i;
                    displayQuestion(questions[i], i);
                    return;
                }
            }
            questionsContainer.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 20px;">
                    未找到${selectedType === 'multiple' ? '多选题' : 
                           selectedType === 'single' ? '单选题' : '简答题'}
                </div>`;
        } else {
            currentQuestionIndex = 0;
            displayQuestion(questions[0], 0);
        }
    });

    // 修改检查答案的函数
    function checkAnswer(selectedOption, correctAnswer) {
        const questionCard = event.target.closest('.question-card');
        const errorMessage = questionCard.querySelector('.error-message');
        const buttons = questionCard.querySelectorAll('.option-button');
        const selectedButton = event.target;
        
        // 从选项中提取选项字母（A、B、C、D）
        const selectedLetter = selectedOption.match(/^[A-D]/i)?.[0].toUpperCase();
        
        if (selectedLetter === correctAnswer) {
            // 答对了
            errorMessage.style.display = 'none';
            errorMessage.style.color = '#4CAF50';
            errorMessage.textContent = '回答正确！';
            errorMessage.style.display = 'block';
            
            // 禁用所有选项按钮并标记正确答案
            buttons.forEach(button => {
                button.disabled = true;
                if (button === selectedButton) {
                    button.style.backgroundColor = '#4CAF50';
                    button.style.color = 'white';
                }
            });
            
            // 启用导航按钮
            const navigationButtons = questionCard.querySelector('.navigation-buttons');
            if (navigationButtons) {
                const nextButton = navigationButtons.querySelector('.next-button');
                if (nextButton) {
                    nextButton.disabled = getNextQuestion() === -1;
                }
            }
        } else {
            // 答错了
            errorMessage.style.color = 'red';
            errorMessage.style.display = 'block';
            errorMessage.textContent = `回答错误！正确答案是：${correctAnswer}`;
            selectedButton.style.backgroundColor = '#ff6b6b';
            selectedButton.style.color = 'white';
            
            // 1.5秒后重置错误选项的样式
            setTimeout(() => {
                selectedButton.style.backgroundColor = '';
                selectedButton.style.color = '';
                errorMessage.style.display = 'none';
            }, 1500);
        }
    }

    // 添加多选答案检查函数
    function checkMultipleAnswer(correctAnswer) {
        const questionCard = event.target.closest('.question-card');
        const errorMessage = questionCard.querySelector('.error-message');
        const checkboxes = questionCard.querySelectorAll('.option-checkbox:checked');
        const confirmButton = questionCard.querySelector('.confirm-button');
        
        // 获取选中的选项
        const selectedAnswers = Array.from(checkboxes)
            .map(cb => cb.value)
            .sort()
            .join('');
        
        // 正确答案可能是 "ABC" 这样的格式，需要确保顺序一致
        const sortedCorrectAnswer = correctAnswer.split('')
            .sort()
            .join('');
        
        if (selectedAnswers === sortedCorrectAnswer) {
            // 答对了
            errorMessage.style.color = '#4CAF50';
            errorMessage.textContent = '回答正确！';
            errorMessage.style.display = 'block';
            
            // 禁用所有复选框和确认按钮
            questionCard.querySelectorAll('.option-checkbox').forEach(cb => {
                cb.disabled = true;
            });
            confirmButton.disabled = true;
            
            // 标记正确选项
            checkboxes.forEach(cb => {
                cb.closest('.option-label').style.backgroundColor = '#4CAF50';
                cb.closest('.option-label').style.color = 'white';
            });
            
            // 延迟后进入下一题
            setTimeout(() => {
                if (currentQuestionIndex < questions.length - 1) {
                    currentQuestionIndex++;
                    displayQuestion(questions[currentQuestionIndex], currentQuestionIndex);
                } else {
                    questionsContainer.innerHTML = `
                        <div class="completion-message" style="text-align: center; padding: 20px;">
                            <h2 style="color: #4CAF50;">🎉 恭喜你，通关所有关卡！</h2>
                        </div>
                    `;
                }
            }, 1500);
        } else {
            // 答错了
            errorMessage.style.color = 'red';
            errorMessage.style.display = 'block';
            errorMessage.textContent = `回答错误！正确答案是：${correctAnswer}`;
            
            // 标记错误选项
            checkboxes.forEach(cb => {
                cb.closest('.option-label').style.backgroundColor = '#ff6b6b';
                cb.closest('.option-label').style.color = 'white';
            });
            
            // 延迟后重置样式
            setTimeout(() => {
                checkboxes.forEach(cb => {
                    cb.checked = false;
                    cb.closest('.option-label').style.backgroundColor = '';
                    cb.closest('.option-label').style.color = '';
                });
                errorMessage.style.display = 'none';
            }, 1500);
        }
    }

    // 添加切换显示答案的函数
    function toggleAnswer(answer) {
        const questionCard = event.target.closest('.question-card');
        const answerDisplay = questionCard.querySelector('.answer-display');
        const viewAnswerButton = questionCard.querySelector('.view-answer-button');
        
        if (answerDisplay.style.display === 'none') {
            answerDisplay.style.display = 'block';
            answerDisplay.innerHTML = `<div class="correct-answer">参考答案：${answer}</div>`;
            viewAnswerButton.textContent = '隐藏答案';
        } else {
            answerDisplay.style.display = 'none';
            viewAnswerButton.textContent = '查看答案';
        }
    }
}); 