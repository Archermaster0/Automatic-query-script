# Automatic-query-script
自动查询 node 脚本

# 脚本对应程序名称
1000HD供应商：my-query
1JF供应商：my-query-1JF

# 1JF对应的账号密码
账号：1JF
密码：1JF0.000

# 启动配置文件中的所有应用
pm2 start pm2.json

# 查看所有运行的应用
pm2 list

# 停止（完全停止，不会自动重启）
pm2 stop my-query

# 同时停止多个
pm2 stop my-query my-query-2

# 暂停所有
pm2 stop all

# 启动已停止的应用
pm2 start my-query

# 从配置文件中启动特定应用
pm2 start pm2.json --only "my-query"

# 启动多个
pm2 start my-query my-query-2

# 重启应用（会短暂中断）
pm2 restart my-query

# 优雅重启（零停机）
pm2 reload my-query

# 重启多个
pm2 restart my-query my-query-2
