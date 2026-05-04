import React, { useState, useCallback, useEffect } from 'react';
import './App.css';
import { MODES, WORD_LIST, CONSONANTS, VOWELS, CellStatus, GameMode } from './constants';

interface RankEntry {
  nickname: string;
  score: number;
  type: string;
  size: number;
  timestamp: number;
}

interface GameState {
  guesses: string[][];
  statuses: CellStatus[][];
  usedKeys: Record<string, CellStatus>;
  currentRow: number;
  currentCol: number;
  targetWord: string[];
  isGameOver: boolean;
  isWin: boolean;
  timeLeft?: number;
  totalSolved?: number;
  personalBest?: number;
  isNewBest: boolean;
}

const API_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:5000/api';

function App() {
  const [userNickname, setUserNickname] = useState<string | null>(localStorage.getItem('jamoword_nickname'));
  const [nicknameInput, setNicknameInput] = useState('');
  const [currentMode, setCurrentMode] = useState<GameMode | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [rankingTab, setRankingTab] = useState<'daily' | 'weekly'>('daily');
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [personalBest, setPersonalBest] = useState<number>(0);
  const [totalStats, setTotalStats] = useState<{normal: number, timeattack: number, infinite: number}>({normal: 0, timeattack: 0, infinite: 0});



    // Helper: Fetch Personal Best from Server
  const getRemotePersonalBest = useCallback(async (type: string, size: number) => {
    if (!userNickname) return 0;
    try {
      const response = await fetch(`${API_URL}/personal-best?nickname=${encodeURIComponent(userNickname)}&type=${type}&size=${size}`);
      const best = await response.json();
      return best as number;
    } catch (error) {
      console.error('Failed to fetch personal best:', error);
      return 0;
    }
  }, [userNickname]);
  // Helper: Fetch Overall Stats from Server
  const fetchOverallStats = useCallback(async () => {
    if (!userNickname) return;
    try {
      const [n5, n6, n7, t5, t6, t7, i5, i6, i7] = await Promise.all([
        getRemotePersonalBest('normal', 5), getRemotePersonalBest('normal', 6), getRemotePersonalBest('normal', 7),
        getRemotePersonalBest('timeattack', 5), getRemotePersonalBest('timeattack', 6), getRemotePersonalBest('timeattack', 7),
        getRemotePersonalBest('infinite', 5), getRemotePersonalBest('infinite', 6), getRemotePersonalBest('infinite', 7)
      ]);
      setTotalStats({
        normal: n5 + n6 + n7,
        timeattack: Math.max(t5, t6, t7),
        infinite: Math.max(i5, i6, i7)
      });
    } catch (error) {
      console.error('Failed to fetch overall stats:', error);
    }
  }, [userNickname, getRemotePersonalBest]);

  useEffect(() => {
    if (!currentMode && userNickname) {
      fetchOverallStats();
    }
  }, [currentMode, userNickname, fetchOverallStats]);

  // Helper: Fetch Rankings from Server
  const fetchRankings = useCallback(async () => {
    setIsLoadingRankings(true);
    try {
      const response = await fetch(`${API_URL}/rankings?period=${rankingTab}`);
      const data = await response.json();
      setRankings(data);
    } catch (error) {
      console.error('Failed to fetch rankings:', error);
    } finally {
      setIsLoadingRankings(false);
    }
  }, [rankingTab]);



  useEffect(() => {
    if (isRankingOpen) {
      fetchRankings();
    }
  }, [isRankingOpen, fetchRankings]);

  // Update PB when mode changes
  useEffect(() => {
    if (currentMode && userNickname) {
      getRemotePersonalBest(currentMode.type, currentMode.size).then(setPersonalBest);
    }
  }, [currentMode, userNickname, getRemotePersonalBest]);

  const registerNickname = () => {
    if (nicknameInput.trim().length < 2) {
      alert('닉네임을 2자 이상 입력해주세요.');
      return;
    }
    localStorage.setItem('jamoword_nickname', nicknameInput);
    setUserNickname(nicknameInput);
  };

  const initGame = useCallback(async (mode: GameMode) => {
    const list = WORD_LIST[mode.size];
    const target = list[Math.floor(Math.random() * list.length)];
    const pb = await getRemotePersonalBest(mode.type, mode.size);
    
    let timerSeconds = undefined;
    if (mode.type === 'timeattack') timerSeconds = 120;
    if (mode.type === 'infinite') timerSeconds = 600;

    setGameState({
      guesses: Array(mode.size).fill(null).map(() => Array(mode.size).fill('')),
      statuses: Array(mode.size).fill(null).map(() => Array(mode.size).fill('empty')),
      usedKeys: {},
      currentRow: 0,
      currentCol: 0,
      targetWord: target,
      isGameOver: false,
      isWin: false,
      timeLeft: timerSeconds,
      totalSolved: 0,
      personalBest: pb,
      isNewBest: false,
    });
    setCurrentMode(mode);
  }, [getRemotePersonalBest]);

  const saveScore = useCallback(async (score: number) => {
    if (!userNickname || !currentMode) return;
    
    const newEntry: RankEntry = {
      nickname: userNickname,
      score,
      type: currentMode.type,
      size: currentMode.size,
      timestamp: Date.now(),
    };

    try {
      await fetch(`${API_URL}/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntry),
      });

      // Update PB locally if it's a new record
      if (score > personalBest) {
        setPersonalBest(score);
        setGameState(prev => prev ? { ...prev, isNewBest: true, personalBest: score } : prev);
      } else if (currentMode.type === 'normal') {
        // For normal mode, we might want to fetch the updated count or just flag success
        setGameState(prev => prev ? { ...prev, isNewBest: true } : prev);
      }
    } catch (error) {
      console.error('Failed to save score to server:', error);
      // Fallback: alert or local save if needed
    }
  }, [userNickname, currentMode, personalBest]);

  const nextWord = useCallback(() => {
    if (!currentMode || !gameState) return;
    const list = WORD_LIST[currentMode.size];
    const target = list[Math.floor(Math.random() * list.length)];
    
    setGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        guesses: Array(currentMode.size).fill(null).map(() => Array(currentMode.size).fill('')),
        statuses: Array(currentMode.size).fill(null).map(() => Array(currentMode.size).fill('empty')),
        usedKeys: {},
        currentRow: 0,
        currentCol: 0,
        targetWord: target,
        isWin: false,
        totalSolved: (prev.totalSolved || 0) + 1,
      };
    });
  }, [currentMode, gameState]);

  const handleInput = useCallback((key: string) => {
    setGameState(prev => {
      if (!prev || prev.isGameOver) return prev;
      const { currentRow, currentCol, guesses } = prev;
      const size = currentMode!.size;

      if (currentCol < size) {
        const newGuesses = [...guesses];
        newGuesses[currentRow] = [...newGuesses[currentRow]];
        newGuesses[currentRow][currentCol] = key;
        return {
          ...prev,
          guesses: newGuesses,
          currentCol: currentCol + 1,
        };
      }
      return prev;
    });
  }, [currentMode]);

  const handleDelete = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.isGameOver) return prev;
      const { currentRow, currentCol, guesses } = prev;

      if (currentCol > 0) {
        const newGuesses = [...guesses];
        newGuesses[currentRow] = [...newGuesses[currentRow]];
        newGuesses[currentRow][currentCol - 1] = '';
        return {
          ...prev,
          guesses: newGuesses,
          currentCol: currentCol - 1,
        };
      }
      return prev;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    setGameState(prev => {
      if (!prev || prev.isGameOver) return prev;
      const { currentRow, currentCol, guesses, targetWord, statuses, usedKeys } = prev;
      const size = currentMode!.size;

      if (currentCol === size) {
        const currentGuess = guesses[currentRow];
        const newStatuses = [...statuses];
        const rowStatuses: CellStatus[] = Array(size).fill('absent');
        const newUsedKeys = { ...usedKeys };
        
        const targetCopy = [...targetWord];
        const guessCopy = [...currentGuess];

        for (let i = 0; i < size; i++) {
          const char = currentGuess[i];
          if (char === targetCopy[i]) {
            rowStatuses[i] = 'correct';
            targetCopy[i] = '';
            guessCopy[i] = '';
            newUsedKeys[char] = 'correct';
          }
        }

        for (let i = 0; i < size; i++) {
          const char = guessCopy[i];
          if (char !== '') {
            const index = targetCopy.indexOf(char);
            if (index !== -1) {
              rowStatuses[i] = 'present';
              targetCopy[index] = '';
              if (newUsedKeys[char] !== 'correct') {
                newUsedKeys[char] = 'present';
              }
            } else {
              if (newUsedKeys[char] !== 'correct' && newUsedKeys[char] !== 'present') {
                newUsedKeys[char] = 'absent';
              }
            }
          }
        }

        newStatuses[currentRow] = rowStatuses;
        const isWin = rowStatuses.every(s => s === 'correct');
        const isGameOver = (!isWin && currentRow === size - 1) || (currentMode?.type === 'normal' && isWin);

        if (isGameOver && currentMode?.type === 'normal' && isWin) {
          saveScore(1);
        }

        return {
          ...prev,
          statuses: newStatuses,
          usedKeys: newUsedKeys,
          currentRow: currentRow + 1,
          currentCol: 0,
          isGameOver,
          isWin,
        };
      }
      return prev;
    });
  }, [currentMode, saveScore]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState && (currentMode?.type === 'timeattack' || currentMode?.type === 'infinite') && !gameState.isGameOver) {
      timer = setInterval(() => {
        setGameState(prev => {
          if (!prev || prev.isGameOver) return prev;
          if (prev.timeLeft! <= 1) {
            saveScore(prev.totalSolved || 0);
            return { ...prev, timeLeft: 0, isGameOver: true };
          }
          return { ...prev, timeLeft: prev.timeLeft! - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, currentMode?.type, saveScore]);

  useEffect(() => {
    const isMultiWordMode = currentMode?.type === 'timeattack' || currentMode?.type === 'infinite';
    if (isMultiWordMode && gameState?.isWin && !gameState.isGameOver) {
      const timeout = setTimeout(nextWord, 500);
      return () => clearTimeout(timeout);
    }
  }, [gameState, currentMode?.type, nextWord]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!userNickname || isRankingOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        handleSubmit();
        return;
      } 
      if (e.key === 'Backspace') {
        handleDelete();
        return;
      }

      const CODE_MAP: Record<string, string> = {
        'KeyQ': 'ㅂ', 'KeyW': 'ㅈ', 'KeyE': 'ㄷ', 'KeyR': 'ㄱ', 'KeyT': 'ㅅ', 'KeyY': 'ㅛ', 'KeyU': 'ㅕ', 'KeyI': 'ㅑ',
        'KeyA': 'ㅁ', 'KeyS': 'ㄴ', 'KeyD': 'ㅇ', 'KeyF': 'ㄹ', 'KeyG': 'ㅎ', 'KeyH': 'ㅗ', 'KeyJ': 'ㅓ', 'KeyK': 'ㅏ', 'KeyL': 'ㅣ',
        'KeyZ': 'ㅋ', 'KeyX': 'ㅌ', 'KeyC': 'ㅊ', 'KeyV': 'ㅍ', 'KeyB': 'ㅠ', 'KeyN': 'ㅜ', 'KeyM': 'ㅡ',
      };

      let inputKey = '';
      if (CODE_MAP[e.code]) {
        inputKey = CODE_MAP[e.code];
      } else if (CONSONANTS.includes(e.key) || VOWELS.includes(e.key)) {
        inputKey = e.key;
      }

      if (inputKey) handleInput(inputKey);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput, handleDelete, handleSubmit, userNickname, isRankingOpen]);

  const renderGrid = () => {
    if (!gameState || !currentMode) return null;

    return (
      <div className="grid-container">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${currentMode.size}, 1fr)` }}>
          {gameState.guesses.map((row, i) => (
            row.map((cell, j) => {
              const isActive = !gameState.isGameOver && gameState.currentRow === i && gameState.currentCol === j;
              return (
                <div 
                  key={`${i}-${j}`} 
                  className={`cell ${gameState.statuses[i][j]} ${cell ? 'filled' : ''} ${isActive ? 'active' : ''}`}
                >
                  <span className="cell-content">{cell}</span>
                </div>
              );
            })
          ))}
        </div>
      </div>
    );
  };

  const renderKeyboard = () => {
    const dubeolsikRows = [
      ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ'],
      ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
      ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ']
    ];

    const getKeyClass = (key: string) => {
      const status = gameState?.usedKeys[key];
      return `key ${status || ''} ${key === 'ENTER' || key === 'BACK' ? 'functional' : ''}`;
    };

    return (
      <div className="keyboard">
        {dubeolsikRows.map((row, i) => (
          <div key={i} className="keyboard-row">
            {i === 2 && (
              <button className={getKeyClass('ENTER')} onClick={handleSubmit}>
                ENTER
              </button>
            )}
            {row.map(key => (
              <button key={key} className={getKeyClass(key)} onClick={() => handleInput(key)}>
                {key}
              </button>
            ))}
            {i === 2 && (
              <button className={getKeyClass('BACK')} onClick={handleDelete}>
                BACK
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderRankingModal = () => (
    <div className="overlay premium-overlay ranking-overlay">
      <div className="result-card ranking-card">
        <div className="card-header">
          <h2>🏆 실시간 랭킹</h2>
          <div className="tab-buttons">
            <button className={rankingTab === 'daily' ? 'active' : ''} onClick={() => setRankingTab('daily')}>일간</button>
            <button className={rankingTab === 'weekly' ? 'active' : ''} onClick={() => setRankingTab('weekly')}>주간</button>
          </div>
        </div>
        <div className="ranking-list">
          {isLoadingRankings ? (
            <p className="loading">불러오는 중...</p>
          ) : rankings.length > 0 ? (
            rankings.map((r, i) => (
              <div key={i} className="ranking-item">
                <span className="rank">{i + 1}</span>
                <span className="name">{r.nickname}</span>
                <span className="mode-tag">{r.type}</span>
                <span className="score-val">{r.score}</span>
              </div>
            ))
          ) : (
            <p className="no-data">기록된 데이터가 없습니다.</p>
          )}
        </div>
        <button className="btn-primary" onClick={() => setIsRankingOpen(false)}>닫기</button>
      </div>
    </div>
  );

  const renderHeader = () => (
    <header className="app-header">
      <div className="header-left">
        <div className="logo" onClick={() => setCurrentMode(null)}>JAMOWORD</div>
      </div>
      <div className="header-center">
        {currentMode && <div className="game-title">{currentMode.label}</div>}
      </div>
      <div className="header-right">
        <div className="nav-item" onClick={() => setIsRankingOpen(true)}>🏆 Rankings</div>
        <div className="nav-item profile" title={userNickname || ''}>{userNickname ? userNickname[0] : '👤'}</div>
      </div>
    </header>
  );

  const renderFooter = () => (
    <footer className="app-footer">
      <div className="footer-content">
        <span>© 2026 둥무룩. All rights reserved.</span>
      </div>
    </footer>
  );

  if (!userNickname) {
    return (
      <div className="App premium onboarding">
        <div className="onboarding-card">
          <h1>JAMOWORD</h1>
          <p>시작하기 전에 닉네임을 설정해주세요.</p>
          <div className="input-group">
            <input 
              type="text" 
              placeholder="닉네임 입력 (2자 이상)" 
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && registerNickname()}
            />
            <button onClick={registerNickname}>시작하기</button>
          </div>
          <p className="notice">※ 로컬 스토리지에 저장되며, 전역 중복 확인은 지원하지 않습니다.</p>
        </div>
      </div>
    );
  }

  if (!currentMode) {
    const normalModes = MODES.filter(m => m.type === 'normal');
    const timeAttackModes = MODES.filter(m => m.type === 'timeattack');
    const infiniteModes = MODES.filter(m => m.type === 'infinite');

    return (
      <div className="App premium">
        {renderHeader()}
        <main className="dashboard">
          <section className="welcome-hero">
            <h1>안녕하세요, {userNickname}님!</h1>
            <p>자음과 모음을 조합하여 숨겨진 단어를 찾아내는 프리미엄 자모 게임입니다.</p>
          </section>

          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="card-header">
                <h3>일반 모드</h3>
              </div>
              <p>기회 내에 차분하게 단어를 추리하세요.</p>
              <div className="pb-badge">
                내 기록: <span>{totalStats.normal}개</span> 정복
              </div>
              <div className="mode-buttons">
                {normalModes.map((m, i) => (
                  <button key={i} onClick={() => initGame(m)} className="btn-normal">
                    {m.size}x{m.size}
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-card highlight">
              <div className="card-header">
                <h3>타임어택 모드</h3>
              </div>
              <p>60초 동안 최대한 많은 단어를 맞추세요.</p>
              <div className="pb-badge">
                최고 점수: <span>{totalStats.timeattack}개</span>
              </div>
              <div className="mode-buttons">
                {timeAttackModes.map((m, i) => (
                  <button key={i} onClick={() => initGame(m)} className="btn-timeattack">
                    {m.size}x{m.size}
                  </button>
                ))}
              </div>
            </div>

            <div className="dashboard-card special">
              <div className="card-header">
                <h3>무한의 단어</h3>
              </div>
              <p>10분 동안 한계가 없는 도전을 즐기세요.</p>
              <div className="pb-badge">
                최고 점수: <span>{totalStats.infinite}개</span>
              </div>
              <div className="mode-buttons">
                {infiniteModes.map((m, i) => (
                  <button key={i} onClick={() => initGame(m)} className="btn-infinite">
                    {m.size}x{m.size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
        {isRankingOpen && renderRankingModal()}
        {renderFooter()}
      </div>
    );
  }

  return (
    <div className="App premium game-active">
      {renderHeader()}
      
      <main className="game-container">
        <div className="game-layout">
          <div className="game-sidebar left">
            <button className="back-nav" onClick={() => setCurrentMode(null)}>← 나가기</button>
          </div>

          <div className="game-main">
            <div className="game-status-bar">
              <div className="premium-stats">
                {(currentMode.type === 'timeattack' || currentMode.type === 'infinite') && (
                  <div className="stat-item timer-stat">
                    <span className="label">REMAINING</span>
                    <span className="value">{formatTime(gameState?.timeLeft || 0)}</span>
                  </div>
                )}
                <div className="stat-item score-stat">
                  <span className="label">SOLVED</span>
                  <span className="value">🔥 {gameState?.totalSolved}</span>
                </div>
                <div className="stat-item pb-stat">
                  <span className="label">PERSONAL BEST</span>
                  <span className="value">⭐ {gameState?.personalBest}</span>
                </div>
              </div>
            </div>

            <div className="game-board-wrapper">
              {renderGrid()}
            </div>

            <div className="game-keyboard-wrapper">
              {renderKeyboard()}
            </div>
          </div>

          <div className="game-sidebar right">
            <div className="how-to-play">
              <h4>HOW TO PLAY</h4>
              <ul>
                <li><strong>일반 모드</strong>: 정해진 기회 내에 하나의 단어를 맞추는 기본 모드입니다.</li>
                <li><strong>타임어택</strong>: 60초 동안 최대한 많은 단어를 맞추는 긴박한 모드입니다.</li>
                <li><strong>무한의 단어</strong>: 10분 동안 자신의 한계에 도전하는 마라톤 모드입니다.</li>
                <hr style={{ margin: '12px 0', border: '0.5px solid #eee' }} />
                <li>{"자음과 모음을 분리해서 입력하세요 (예: ㅐ -> ㅏ + ㅣ)."}</li>
                <li>ENTER는 실제 키보드의 엔터 키입니다.</li>
                <li>색상 힌트를 통해 단어를 추리하세요.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {gameState?.isGameOver && (
        <div className="overlay premium-overlay">
          <div className="result-card">
            {currentMode.type !== 'normal' ? (
              <>
                <div className="result-icon">{gameState.isNewBest ? '🎉' : '🏁'}</div>
                {gameState.isNewBest && <div className="new-record-badge">NEW RECORD!</div>}
                <h2>게임 종료!</h2>
                <div className="final-stats-display">
                  <div className="big-score">
                    <span className="num">{gameState.totalSolved}</span>
                    <span className="unit">WORDS</span>
                  </div>
                  <p className="desc">{currentMode.type === 'timeattack' ? '60초의 도전이 끝났습니다.' : '10분의 대장정이 끝났습니다.'}</p>
                </div>
              </>
            ) : (
              <>
                <div className="result-icon">{gameState.isWin ? '✨' : '💨'}</div>
                <h2>{gameState.isWin ? '미션 성공!' : '조금 아쉽네요'}</h2>
                <div className="answer-reveal">
                  <span className="label">정답은</span>
                  <span className="word">{gameState.targetWord.join('')}</span>
                </div>
              </>
            )}
            <div className="result-actions">
              <button className="btn-primary" onClick={() => setCurrentMode(null)}>대시보드로 돌아가기</button>
              <button className="btn-secondary" onClick={() => initGame(currentMode)}>다시 도전</button>
            </div>
          </div>
        </div>
      )}
      {isRankingOpen && renderRankingModal()}
      {renderFooter()}
    </div>
  );
}

export default App;
