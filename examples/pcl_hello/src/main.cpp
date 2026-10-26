#include <chrono>
#include <iostream>
#include <string>

#include <pcl/features/normal_3d.h>
#include <pcl/filters/passthrough.h>
#include <pcl/io/pcd_io.h>
#include <pcl/point_cloud.h>
#include <pcl/point_types.h>
#include <pcl/search/kdtree.h>

namespace {

using Clock = std::chrono::steady_clock;

double
elapsed_ms(Clock::time_point start)
{
  return std::chrono::duration<double, std::milli>(Clock::now() - start).count();
}

void
print_cloud_info(const pcl::PointCloud<pcl::PointXYZ>& cloud)
{
  std::cout << "  points : " << cloud.size() << '\n';
  std::cout << "  width  : " << cloud.width << '\n';
  std::cout << "  height : " << cloud.height << '\n';
  std::cout << "  dense  : " << (cloud.is_dense ? "yes" : "no") << '\n';
  std::cout << "  organized: " << (cloud.height > 1 ? "yes" : "no") << '\n';
}

} // namespace

int
main(int argc, char** argv)
{
  const std::string input_path = (argc > 1) ? argv[1] : "frame.pcd";

  pcl::PointCloud<pcl::PointXYZ>::Ptr cloud(new pcl::PointCloud<pcl::PointXYZ>);
  std::cout << "[1] load point cloud: " << input_path << '\n';
  auto t0 = Clock::now();
  if (pcl::io::loadPCDFile(input_path, *cloud) == -1) {
    std::cerr << "Failed to read: " << input_path << '\n';
    std::cerr << "Usage: pcl_hello <path/to/frame.pcd>\n";
    return 1;
  }
  std::cout << "  load time: " << elapsed_ms(t0) << " ms\n";
  print_cloud_info(*cloud);

  std::cout << "[2] pass-through filter on z axis\n";
  pcl::PassThrough<pcl::PointXYZ> pass;
  pass.setInputCloud(cloud);
  pass.setFilterFieldName("z");
  pass.setFilterLimits(0.5f, 30.0f);

  pcl::PointCloud<pcl::PointXYZ>::Ptr filtered(new pcl::PointCloud<pcl::PointXYZ>);
  t0 = Clock::now();
  pass.filter(*filtered);
  std::cout << "  filter time: " << elapsed_ms(t0) << " ms\n";
  print_cloud_info(*filtered);

  std::cout << "[3] normal estimation (KdTree, k=20)\n";
  pcl::search::KdTree<pcl::PointXYZ>::Ptr tree(new pcl::search::KdTree<pcl::PointXYZ>);
  pcl::NormalEstimation<pcl::PointXYZ, pcl::Normal> ne;
  ne.setInputCloud(filtered);
  ne.setSearchMethod(tree);
  ne.setKSearch(20);

  pcl::PointCloud<pcl::Normal>::Ptr normals(new pcl::PointCloud<pcl::Normal>);
  t0 = Clock::now();
  ne.compute(*normals);
  std::cout << "  normal time: " << elapsed_ms(t0) << " ms\n";
  std::cout << "  normals   : " << normals->size() << '\n';

  std::cout << "done.\n";
  return 0;
}
