const Equalizer = () => {
  return (
    <div className="flex items-end gap-[2px] w-4 h-4">
      <div className="w-[2px] bg-violet-500 animate-[eqJump_1.2s_steps(5,end)_infinite] [animation-delay:0s]" />
      <div className="w-[2px] bg-violet-500 animate-[eqJump_1s_steps(4,end)_infinite] [animation-delay:0.2s]" />
      <div className="w-[2px] bg-violet-500 animate-[eqJump_1.3s_steps(6,end)_infinite] [animation-delay:0.1s]" />
      <div className="w-[2px] bg-violet-500 animate-[eqJump_1.1s_steps(5,end)_infinite] [animation-delay:0.3s]" />

      <style>{`
        @keyframes eqJump {
          0% {
            height: 20%;
          }
          25% {
            height: 80%;
          }
          50% {
            height: 40%;
          }
          75% {
            height: 100%;
          }
          100% {
            height: 30%;
          }
        }
      `}</style>
    </div>
  );
};

export default Equalizer;
