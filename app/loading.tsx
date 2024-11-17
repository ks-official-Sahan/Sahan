// "use client";

// import React from "react";
// import { motion } from "framer-motion";
// import { Site } from "@/config/site";

// const Loading = () => {
//   return (
//     <motion.div
//       initial={{ opacity: 0 }}
//       animate={{ opacity: 1 }}
//       transition={{ type: "spring", duration: 3.5, delay: 0.1 }}
//     >
//       <div className="w-[288px] min-h-[288px] rounded-[24px] border bg-[#f7f7f7] dark:bg-[#00000052] px-[40px] py-[50px]">
//         <div className="text-center font-bold text-[2rem]">
//           <span className="text-[#19cf31] dark:text-[#91FF00]">
//             {Site.authorFullName}
//           </span>
//         </div>
//         <div className="text-center font-medium text-secondaryT pt-[40px]">
//           Loading
//         </div>
//       </div>
//     </motion.div>
//   );
// };

// export default Loading;

"use client";

import { motion } from "framer-motion";

const Loading = () => {
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-gray-900 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="text-white text-3xl font-bold"
        initial={{ scale: 0 }}
        animate={{ scale: 1, rotate: 360 }}
        exit={{ scale: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 10,
        }}
      >
        Loading...
      </motion.div>
    </motion.div>
  );
};

export default Loading;
