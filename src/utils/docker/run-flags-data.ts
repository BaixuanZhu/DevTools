/**
 * docker run 常用 flag 速查数据。
 *
 * 按分类整理最常用的 flag，用于 Docker Run 命令助手页面的速查表。
 */

/** flag 分类 */
export type RunFlagCategory =
  | '基础运行'
  | '网络'
  | '存储'
  | '环境变量'
  | '资源限制'
  | '重启与生命周期'
  | '安全与权限'
  | '日志与监控'
  | '其他常用';

/** 单条 flag 条目 */
export interface RunFlagEntry {
  /** flag 名称，如 `-p, --publish` */
  flag: string;
  /** 所属分类 */
  category: RunFlagCategory;
  /** 中文说明，要求简洁 */
  description: string;
  /** 示例命令 */
  example: string;
}

/** 所有分类顺序 */
export const RUN_FLAG_CATEGORIES: RunFlagCategory[] = [
  '基础运行',
  '网络',
  '存储',
  '环境变量',
  '资源限制',
  '重启与生命周期',
  '安全与权限',
  '日志与监控',
  '其他常用',
];

/** 常用 docker run flag 列表 */
export const RUN_FLAGS: RunFlagEntry[] = [
  // 基础运行
  { flag: '-d, --detach', category: '基础运行', description: '后台运行容器', example: 'docker run -d nginx' },
  { flag: '--name', category: '基础运行', description: '指定容器名称', example: 'docker run --name my-nginx nginx' },
  { flag: '--rm', category: '基础运行', description: '停止后自动删除容器', example: 'docker run --rm nginx' },
  { flag: '-it', category: '基础运行', description: '以交互式终端运行', example: 'docker run -it ubuntu bash' },
  { flag: '-w, --workdir', category: '基础运行', description: '设置容器内工作目录', example: 'docker run -w /app node' },
  { flag: '--entrypoint', category: '基础运行', description: '覆盖镜像默认入口命令', example: 'docker run --entrypoint sh nginx' },

  // 网络
  { flag: '-p, --publish', category: '网络', description: '将主机端口映射到容器端口', example: 'docker run -p 8080:80 nginx' },
  { flag: '-P, --publish-all', category: '网络', description: '暴露 Dockerfile 中所有 EXPOSE 端口到随机主机端口', example: 'docker run -P nginx' },
  { flag: '--network', category: '网络', description: '指定容器网络模式', example: 'docker run --network host nginx' },
  { flag: '--hostname', category: '网络', description: '设置容器主机名', example: 'docker run --hostname web nginx' },
  { flag: '--dns', category: '网络', description: '自定义 DNS 服务器', example: 'docker run --dns 8.8.8.8 nginx' },
  { flag: '--expose', category: '网络', description: '声明容器运行时开放的端口', example: 'docker run --expose 8080 nginx' },
  { flag: '--link', category: '网络', description: '链接到另一个容器（旧版方式）', example: 'docker run --link db:mysql app' },

  // 存储
  { flag: '-v, --volume', category: '存储', description: '挂载主机目录或数据卷到容器', example: 'docker run -v /data:/app/data nginx' },
  { flag: '--mount', category: '存储', description: '以更详细的语法挂载存储', example: 'docker run --mount type=bind,src=/data,dst=/app/data nginx' },
  { flag: '--tmpfs', category: '存储', description: '挂载 tmpfs 临时文件系统', example: 'docker run --tmpfs /tmp:rw,noexec,nosuid,size=100m nginx' },
  { flag: '--read-only', category: '存储', description: '将容器根文件系统设为只读', example: 'docker run --read-only nginx' },

  // 环境变量
  { flag: '-e, --env', category: '环境变量', description: '设置环境变量', example: 'docker run -e NODE_ENV=production node' },
  { flag: '--env-file', category: '环境变量', description: '从文件读取环境变量', example: 'docker run --env-file .env node' },

  // 资源限制
  { flag: '-m, --memory', category: '资源限制', description: '限制容器可用内存', example: 'docker run -m 512m nginx' },
  { flag: '--memory-swap', category: '资源限制', description: '限制内存加交换分区总量', example: 'docker run -m 512m --memory-swap 1g nginx' },
  { flag: '--cpus', category: '资源限制', description: '限制容器可用 CPU 核心数', example: 'docker run --cpus 1.5 nginx' },
  { flag: '--cpu-shares', category: '资源限制', description: '设置 CPU 相对权重', example: 'docker run --cpu-shares 512 nginx' },
  { flag: '--pids-limit', category: '资源限制', description: '限制容器内进程数', example: 'docker run --pids-limit 100 nginx' },

  // 重启与生命周期
  { flag: '--restart', category: '重启与生命周期', description: '设置容器退出后的重启策略', example: 'docker run --restart unless-stopped nginx' },
  { flag: '--stop-signal', category: '重启与生命周期', description: '指定停止容器时发送的信号', example: 'docker run --stop-signal SIGTERM nginx' },
  { flag: '--stop-timeout', category: '重启与生命周期', description: '设置停止容器前的等待秒数', example: 'docker run --stop-timeout 30 nginx' },

  // 安全与权限
  { flag: '--privileged', category: '安全与权限', description: '授予容器扩展权限', example: 'docker run --privileged ubuntu' },
  { flag: '--cap-add', category: '安全与权限', description: '添加 Linux 能力', example: 'docker run --cap-add NET_ADMIN ubuntu' },
  { flag: '--cap-drop', category: '安全与权限', description: '移除 Linux 能力', example: 'docker run --cap-drop ALL ubuntu' },
  { flag: '-u, --user', category: '安全与权限', description: '指定运行用户', example: 'docker run -u 1000:1000 nginx' },
  { flag: '--group-add', category: '安全与权限', description: '添加用户组', example: 'docker run --group-add video nginx' },
  { flag: '--security-opt', category: '安全与权限', description: '设置安全选项', example: 'docker run --security-opt no-new-privileges:true nginx' },

  // 日志与监控
  { flag: '--log-driver', category: '日志与监控', description: '指定日志驱动', example: 'docker run --log-driver json-file nginx' },
  { flag: '--log-opt', category: '日志与监控', description: '设置日志驱动选项', example: 'docker run --log-opt max-size=10m nginx' },
  { flag: '--health-cmd', category: '日志与监控', description: '设置健康检查命令', example: 'docker run --health-cmd "curl -f http://localhost/" nginx' },
  { flag: '--health-interval', category: '日志与监控', description: '设置健康检查间隔', example: 'docker run --health-cmd "true" --health-interval 30s nginx' },

  // 其他常用
  { flag: '-l, --label', category: '其他常用', description: '为容器添加元数据标签', example: 'docker run -l env=prod nginx' },
  { flag: '--label-file', category: '其他常用', description: '从文件读取标签', example: 'docker run --label-file labels.txt nginx' },
  { flag: '--add-host', category: '其他常用', description: '添加主机到 IP 映射', example: 'docker run --add-host example.com:127.0.0.1 nginx' },
  { flag: '--device', category: '其他常用', description: '挂载主机设备到容器', example: 'docker run --device /dev/sda:/dev/xvda ubuntu' },
  { flag: '--ipc', category: '其他常用', description: '设置 IPC 命名空间', example: 'docker run --ipc host ubuntu' },
  { flag: '--pid', category: '其他常用', description: '设置 PID 命名空间', example: 'docker run --pid host ubuntu' },
];
