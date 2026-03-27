import { createContext, useContext } from "solid-js";
import { createStore } from "solid-js/store";

type GameStore = {};

type GameContextType = {
  game: GameStore;
  setGame: (value: Partial<GameStore>) => void;
};

const GameContext = createContext<GameContextType>();

export function GameProvider(props: { children: any }) {
  const [game, setGame] = createStore<GameStore>({});

  return (
    <GameContext.Provider value={{ game, setGame }}>
      {props.children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}

export default GameContext;
