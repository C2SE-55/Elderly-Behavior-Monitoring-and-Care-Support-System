type Listener = () => void;

const listeners = new Set<Listener>();

export const subscribeScheduleRefresh = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const emitScheduleRefresh = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore listener errors
    }
  });
};

