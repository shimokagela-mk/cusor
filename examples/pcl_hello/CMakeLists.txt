cmake_minimum_required(VERSION 3.16)
project(pcl_hello CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# ARM64 release flags (safe defaults for automotive boards)
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -DNDEBUG -march=armv8-a+simd")

find_package(PCL REQUIRED COMPONENTS common io filters features search)
find_package(OpenMP)

include_directories(${PCL_INCLUDE_DIRS})
link_directories(${PCL_LIBRARY_DIRS})
add_definitions(${PCL_DEFINITIONS})

add_executable(pcl_hello src/main.cpp)
target_link_libraries(pcl_hello ${PCL_LIBRARIES})

if(OpenMP_CXX_FOUND)
  target_link_libraries(pcl_hello OpenMP::OpenMP_CXX)
  message(STATUS "OpenMP enabled")
endif()
