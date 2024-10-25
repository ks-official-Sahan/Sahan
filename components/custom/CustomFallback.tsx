// components/CustomFallback.tsx
import { Button } from "@nextui-org/react";
import React from "react";

const CustomFallback = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
      <h1 className="text-4xl font-bold mb-4">Oops! Something went wrong.</h1>
      <p className="text-lg mb-8">
        An unexpected error occurred. Please try refreshing the page.
      </p>
      <Button
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
        onClick={() => window.location.reload()}
      >
        Refresh
      </Button>
    </div>
  );
};

export default CustomFallback;
