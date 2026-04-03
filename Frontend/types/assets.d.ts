declare module '@assets/*';

declare module '*.png' {
  const value: any;
  export default value;
}

declare module '*.mp4' {
  const value: number;
  export default value;
}

