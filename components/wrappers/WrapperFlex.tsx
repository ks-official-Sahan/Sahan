import React from "react";

const WrapperFlex = ({ children }: RegularComponentProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-4 xs:aspect-w-1 xs:aspect-h-1 mobile:aspect-w-4 mobile:aspect-h-3 portrait:aspect-w-3 portrait:aspect-h-4 landscape:aspect-w-16 landscape:aspect-h-9 lg:aspect-w-16 lg:aspect-h-9 wide:aspect-w-21 wide:aspect-h-9">
      {children}
    </div>
  );
};

export default WrapperFlex;
