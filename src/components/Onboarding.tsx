import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CircularProgressBar } from './CircularProgressBar';
import { BookOpen, ChevronDown, ChevronRight, User, Check, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: (username: string, themeColor: string) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState('#E6A79A'); // Terracotta default
  
  // Step 2 mock task states
  const [isExpanded, setIsExpanded] = useState(false);
  const [subtask1Checked, setSubtask1Checked] = useState(false);
  const [subtask2Checked, setSubtask2Checked] = useState(false);

  // Colors available for selection
  const cozyColors = [
    { value: '#E6A79A', name: 'テラコッタ' },
    { value: '#EED09D', name: 'マスタード' },
    { value: '#B5C7A3', name: 'セージグリーン' },
    { value: '#8BA6A9', name: 'スレートブルー' },
  ];

  // Calculate parent mock task progress
  const mockProgress = (subtask1Checked ? 50 : 0) + (subtask2Checked ? 50 : 0);

  const handleNextStep = () => {
    if (step === 1 && !name.trim()) {
      alert('お名前を入力してください。');
      return;
    }
    setStep(step + 1);
  };

  const handleComplete = () => {
    onComplete(name || 'ゲストユーザー', selectedColor);
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#FDFBF7',
        color: '#4A3E3D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: '24px',
        fontFamily: 'var(--font-sans)',
        overflowY: 'auto'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 8px 30px rgba(138, 126, 114, 0.1)',
          border: '1px solid #EAE3D8',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '480px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Header Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              style={{
                width: s === step ? '24px' : '8px',
                height: '8px',
                borderRadius: '9999px',
                backgroundColor: s === step ? selectedColor : '#EAE3D8',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', padding: '16px', background: `${selectedColor}15`, borderRadius: '9999px', marginBottom: '16px', color: selectedColor }}>
                    <BookOpen size={40} />
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 800 }}>Tasknowへようこそ👋</h2>
                  <p style={{ fontSize: '14px', color: '#8A7E72', marginTop: '6px' }}>あなたに合わせた心地よいタスクスペースを作りましょう</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#8A7E72', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ニックネーム</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="text" 
                      placeholder="例: たろう" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 40px',
                        border: '1px solid #EAE3D8',
                        borderRadius: '16px',
                        fontSize: '15px',
                        background: '#FDFBF7',
                        outline: 'none',
                        color: '#4A3E3D'
                      }}
                    />
                    <User size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: '#8A7E72' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#8A7E72', textTransform: 'uppercase', letterSpacing: '0.5px' }}>あなたのテーマカラー</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {cozyColors.map((color) => {
                      const isSelected = selectedColor === color.value;
                      return (
                        <button
                          key={color.value}
                          onClick={() => setSelectedColor(color.value)}
                          style={{
                            padding: '12px 8px',
                            borderRadius: '16px',
                            background: isSelected ? `${color.value}15` : '#FDFBF7',
                            border: isSelected ? `2px solid ${color.value}` : '1.5px solid #EAE3D8',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: color.value }} />
                          <span style={{ fontSize: '10px', fontWeight: 700, color: isSelected ? '#4A3E3D' : '#8A7E72' }}>{color.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <motion.button 
                    onClick={handleNextStep}
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: selectedColor,
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: `0 4px 12px ${selectedColor}33`
                    }}
                  >
                    次へ進む
                    <ArrowRight size={16} />
                  </motion.button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}
              >
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800 }}>簡単な操作体験をしましょう✨</h3>
                  <p style={{ fontSize: '13px', color: '#8A7E72', marginTop: '4px' }}>
                    大タスクをタップして広げ、子タスクをチェックしてみましょう
                  </p>
                </div>

                {/* Mock Board Container */}
                <div 
                  style={{ 
                    background: '#FDFBF7', 
                    padding: '16px', 
                    borderRadius: '24px', 
                    border: '1px solid #EAE3D8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Task Card Prompt Pulse */}
                  <motion.div
                    animate={!isExpanded ? { scale: [1, 1.02, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    onClick={() => setIsExpanded(!isExpanded)}
                    style={{
                      background: '#FFFFFF',
                      border: '1.5px solid #EAE3D8',
                      borderRadius: '20px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'stretch',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(138, 126, 114, 0.05)'
                    }}
                  >
                    <div style={{ width: '4px', backgroundColor: selectedColor, flexShrink: 0, alignSelf: 'stretch', marginRight: '12px', borderRadius: '4px' }} />
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div>{isExpanded ? <ChevronDown size={18} style={{ color: '#8A7E72' }} /> : <ChevronRight size={18} style={{ color: '#8A7E72' }} />}</div>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: '#4A3E3D' }}>大学の課題レポート提出</span>
                      </div>
                      
                      <CircularProgressBar 
                        progress={mockProgress} 
                        size={38} 
                        strokeWidth={5} 
                        color={selectedColor} 
                      />
                    </div>
                  </motion.div>

                  {/* Pulsing Guide Text */}
                  {!isExpanded && (
                    <motion.div 
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      style={{ fontSize: '12px', color: selectedColor, fontWeight: 700, textAlign: 'center' }}
                    >
                      ☝️ 上のタスクカードをタップしてください！
                    </motion.div>
                  )}

                  {/* Child Accordion View */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '20px' }}
                      >
                        {/* Subtask 1 */}
                        <div 
                          style={{
                            background: '#FFFFFF',
                            border: '1.5px solid #EAE3D8',
                            borderRadius: '16px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 2px 4px rgba(138, 126, 114, 0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="checkbox" 
                              checked={subtask1Checked}
                              onChange={(e) => setSubtask1Checked(e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: selectedColor }}
                            />
                            <span style={{ fontSize: '13px', color: subtask1Checked ? '#B5A89E' : '#4A3E3D', textDecoration: subtask1Checked ? 'line-through' : 'none' }}>
                              文献調査・資料集め
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#8A7E72', background: '#F8F4EC', padding: '2px 8px', borderRadius: '9999px' }}>50%分</span>
                        </div>

                        {/* Subtask 2 */}
                        <div 
                          style={{
                            background: '#FFFFFF',
                            border: '1.5px solid #EAE3D8',
                            borderRadius: '16px',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxShadow: '0 2px 4px rgba(138, 126, 114, 0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input 
                              type="checkbox" 
                              checked={subtask2Checked}
                              onChange={(e) => setSubtask2Checked(e.target.checked)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: selectedColor }}
                            />
                            <span style={{ fontSize: '13px', color: subtask2Checked ? '#B5A89E' : '#4A3E3D', textDecoration: subtask2Checked ? 'line-through' : 'none' }}>
                              レポート執筆・推敲
                            </span>
                          </div>
                          <span style={{ fontSize: '10px', color: '#8A7E72', background: '#F8F4EC', padding: '2px 8px', borderRadius: '9999px' }}>50%分</span>
                        </div>

                        {/* Slide Check Tip */}
                        {isExpanded && !subtask1Checked && !subtask2Checked && (
                          <motion.div 
                            animate={{ opacity: [0.6, 1, 0.6] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                            style={{ fontSize: '12px', color: selectedColor, fontWeight: 700, textAlign: 'center', marginTop: '4px' }}
                          >
                            💡 チェックボックスをONにして、進捗ゲージの動きを見てみましょう！
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <button 
                    onClick={handleNextStep}
                    disabled={!subtask1Checked && !subtask2Checked}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: (subtask1Checked || subtask2Checked) ? selectedColor : '#EAE3D8',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: (subtask1Checked || subtask2Checked) ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    進捗を体験したら次へ
                    <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
              >
                <div style={{ position: 'relative' }}>
                  {/* Decorative Sage Rings */}
                  <motion.div 
                    animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ repeat: Infinity, duration: 2.5 }}
                    style={{ position: 'absolute', top: '-10px', left: '-10px', right: '-10px', bottom: '-10px', border: `3px solid ${selectedColor}`, borderRadius: '50%' }}
                  />
                  <div style={{ display: 'flex', padding: '24px', background: `${selectedColor}15`, borderRadius: '50%', color: selectedColor }}>
                    <Check size={48} strokeWidth={3} />
                  </div>
                </div>

                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800 }}>準備が完了しました！</h3>
                  <p style={{ fontSize: '14px', color: '#8A7E72', marginTop: '8px', padding: '0 20px', lineHeight: 1.6 }}>
                    ニックネームは「<strong>{name}</strong>」に設定されました。<br />
                    コージーでリラックスしたタスク管理を始めましょう。
                  </p>
                </div>

                <div style={{ width: '100%', marginTop: 'auto', paddingTop: '16px' }}>
                  <motion.button 
                    onClick={handleComplete}
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: selectedColor,
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '9999px',
                      fontSize: '15px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: `0 4px 12px ${selectedColor}33`
                    }}
                  >
                    はじめる
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
