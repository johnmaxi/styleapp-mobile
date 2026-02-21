import * as SecureStore from "expo-secure-store";

type BarberStats = {
  total: number;
  open: number;
  assigned: number;
  completed: number;
  gross: number;
  commission: number;
  net: number;
};

const KEY = "barber_stats";

const baseStats: BarberStats = {
  total: 0,
  open: 0,
  assigned: 0,
  completed: 0,
  gross: 0,
  commission: 0,
  net: 0,
};

export const getBarberStats = async (): Promise<BarberStats> => {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return { ...baseStats };

  try {
    return { ...baseStats, ...JSON.parse(raw) };
  } catch {
    return { ...baseStats };
  }
};

export const setBarberStats = async (stats: BarberStats) => {
  await SecureStore.setItemAsync(KEY, JSON.stringify(stats));
};

export const markAssigned = async () => {
  const current = await getBarberStats();
  const next = {
    ...current,
    total: current.total + 1,
    assigned: current.assigned + 1,
  };
  await setBarberStats(next);
};

export const markCompleted = async (amount: number) => {
  const current = await getBarberStats();
  const gross = current.gross + amount;
  const commission = current.commission + amount * 0.1;
  const net = current.net + amount * 0.9;

  const next = {
    ...current,
    assigned: Math.max(0, current.assigned - 1),
    completed: current.completed + 1,
    gross,
    commission,
    net,
  };

  await setBarberStats(next);
};
