const TypingIndicator = () => (
  <div className="flex justify-start">
    <div className="bg-muted text-muted-foreground rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-1">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
    </div>
  </div>
);

export default TypingIndicator;
